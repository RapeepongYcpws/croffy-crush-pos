package handlers

import (
	"crypto/rand"
	"database/sql"
	"fmt"
	"math"
	"net/http"
	"regexp"
	"time"

	"github.com/jmoiron/sqlx"

	"github.com/croffy-crush/backend/internal/httpx"
	"github.com/croffy-crush/backend/internal/promptpay"
	"github.com/croffy-crush/backend/internal/settings"
)

// PaymentHandler handles payment + loyalty token issuance/claiming.
type PaymentHandler struct {
	db       *sqlx.DB
	settings *settings.Store
}

func NewPaymentHandler(db *sqlx.DB, s *settings.Store) *PaymentHandler {
	return &PaymentHandler{db: db, settings: s}
}

var thaiPhoneRe = regexp.MustCompile(`^0[0-9]{9}$`)

// qrPayloadFor returns the QR payload for the given provider with a fixed amount.
// Supported providers: "thaiqr" (default, ถุงเงิน) and "promptpay".
func (h *PaymentHandler) qrPayloadFor(provider string, amount float64) (string, string) {
	if provider == "promptpay" {
		return promptpay.WithAmount(promptpay.Build(h.settings.PromptPayID()), amount), "promptpay"
	}
	return promptpay.WithAmount(h.settings.ThaiQRPayload(), amount), "thaiqr"
}

// GetQR returns a static QR payload (no amount) plus the order total.
// Use ?provider=thaiqr (default) or ?provider=promptpay to switch providers.
func (h *PaymentHandler) GetQR(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		httpx.Error(w, http.StatusBadRequest, "invalid id")
		return
	}
	var total float64
	if err := h.db.Get(&total, `SELECT total FROM orders WHERE id=?`, id); err != nil {
		httpx.Error(w, http.StatusNotFound, "order not found")
		return
	}
	payload, provider := h.qrPayloadFor(r.URL.Query().Get("provider"), total)
	httpx.JSON(w, http.StatusOK, map[string]any{
		"payload":  payload,
		"provider": provider,
		"amount":   total,
	})
}

type payInput struct {
	Method   string `json:"method"`   // qr | cash
	Provider string `json:"provider"` // thaiqr | promptpay (only used when method=qr)
}

type payResponse struct {
	OrderID      uint64 `json:"order_id"`
	OrderNumber  string `json:"order_number"`
	LoyaltyToken string `json:"loyalty_token"`
	Points       int    `json:"points"`
	ExpiresAt    string `json:"expires_at"`
}

// Pay marks an order paid and issues a single-use loyalty token (expires in N seconds).
func (h *PaymentHandler) Pay(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		httpx.Error(w, http.StatusBadRequest, "invalid id")
		return
	}
	var in payInput
	if err := httpx.Decode(r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid body")
		return
	}
	if in.Method != "qr" && in.Method != "cash" {
		httpx.Error(w, http.StatusBadRequest, "method must be qr or cash")
		return
	}

	tx, err := h.db.Beginx()
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "tx error")
		return
	}
	defer tx.Rollback()

	var order struct {
		OrderNumber   string  `db:"order_number"`
		Total         float64 `db:"total"`
		PaymentStatus string  `db:"payment_status"`
	}
	if err := tx.Get(&order,
		`SELECT order_number, total, payment_status FROM orders WHERE id=? FOR UPDATE`, id); err != nil {
		httpx.Error(w, http.StatusNotFound, "order not found")
		return
	}
	if order.PaymentStatus == "paid" {
		httpx.Error(w, http.StatusConflict, "order already paid")
		return
	}

	var qrPayload *string
	if in.Method == "qr" {
		p, _ := h.qrPayloadFor(in.Provider, order.Total)
		qrPayload = &p
	}

	if _, err := tx.Exec(
		`UPDATE orders SET payment_status='paid', payment_method=?, paid_at=NOW() WHERE id=?`,
		in.Method, id); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "failed to update order")
		return
	}
	if _, err := tx.Exec(
		`INSERT INTO payments (order_id, method, amount, qr_payload, status, paid_at)
		 VALUES (?, ?, ?, ?, 'paid', NOW())`,
		id, in.Method, order.Total, qrPayload); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "failed to record payment")
		return
	}

	// Issue loyalty token (1 baht = pointsPerBaht points).
	points := int(math.Floor(order.Total)) * h.settings.PointsPerBaht()
	token := newToken()
	ttl := time.Duration(h.settings.LoyaltyTokenTTL()) * time.Second
	expiresAt := time.Now().Add(ttl)

	if _, err := tx.Exec(
		`INSERT INTO loyalty_tokens (token, order_id, points, expires_at) VALUES (?, ?, ?, ?)`,
		token, id, points, expiresAt); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "failed to issue token")
		return
	}

	if err := tx.Commit(); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "commit error")
		return
	}

	httpx.JSON(w, http.StatusOK, payResponse{
		OrderID:      id,
		OrderNumber:  order.OrderNumber,
		LoyaltyToken: token,
		Points:       points,
		ExpiresAt:    expiresAt.Format(time.RFC3339),
	})
}

type loyaltyTokenInfo struct {
	Token       string `db:"token" json:"token"`
	OrderID     uint64 `db:"order_id" json:"order_id"`
	OrderNumber string `db:"order_number" json:"order_number"`
	Points      int    `db:"points" json:"points"`
	Valid       bool   `json:"valid"`
	Reason      string `json:"reason,omitempty"`
}

// GetToken validates a loyalty token (public endpoint for the customer QR page).
func (h *PaymentHandler) GetToken(w http.ResponseWriter, r *http.Request) {
	token := r.PathValue("token")
	info, err := h.lookupToken(h.db, token)
	if err == sql.ErrNoRows {
		httpx.Error(w, http.StatusNotFound, "token not found")
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "lookup failed")
		return
	}
	httpx.JSON(w, http.StatusOK, info)
}

// GetPointsByPhone returns a customer's total points by phone (public endpoint
// for the customer self-service points page). Phone is passed as ?phone=.
func (h *PaymentHandler) GetPointsByPhone(w http.ResponseWriter, r *http.Request) {
	phone := r.URL.Query().Get("phone")
	if !thaiPhoneRe.MatchString(phone) {
		httpx.Error(w, http.StatusBadRequest, "เบอร์โทรไม่ถูกต้อง (ต้องเป็น 10 หลักขึ้นต้นด้วย 0)")
		return
	}
	var row struct {
		ID          uint64 `db:"id"`
		TotalPoints int    `db:"total_points"`
	}
	err := h.db.Get(&row, `SELECT id, total_points FROM customers WHERE phone=?`, phone)
	if err == sql.ErrNoRows {
		httpx.Error(w, http.StatusNotFound, "ไม่พบเบอร์นี้ในระบบสะสมคะแนน")
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "lookup failed")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"customer_id":  row.ID,
		"phone":        phone,
		"total_points": row.TotalPoints,
	})
}

type claimInput struct {
	Phone string `json:"phone"`
}

// ClaimToken redeems a loyalty token for points against a phone number (single use).
func (h *PaymentHandler) ClaimToken(w http.ResponseWriter, r *http.Request) {
	token := r.PathValue("token")
	h.claim(w, r, token, 0)
}

// AdminClaimOrder lets an admin attach a phone to an order's still-valid token.
func (h *PaymentHandler) AdminClaimOrder(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		httpx.Error(w, http.StatusBadRequest, "invalid id")
		return
	}
	h.claim(w, r, "", id)
}

func (h *PaymentHandler) claim(w http.ResponseWriter, r *http.Request, token string, orderID uint64) {
	var in claimInput
	if err := httpx.Decode(r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid body")
		return
	}
	if !thaiPhoneRe.MatchString(in.Phone) {
		httpx.Error(w, http.StatusBadRequest, "เบอร์โทรไม่ถูกต้อง (ต้องเป็น 10 หลักขึ้นต้นด้วย 0)")
		return
	}

	tx, err := h.db.Beginx()
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "tx error")
		return
	}
	defer tx.Rollback()

	var lt struct {
		ID        uint64       `db:"id"`
		OrderID   uint64       `db:"order_id"`
		Points    int          `db:"points"`
		ExpiresAt time.Time    `db:"expires_at"`
		UsedAt    sql.NullTime `db:"used_at"`
	}
	var query string
	var arg any
	if token != "" {
		query = `SELECT id, order_id, points, expires_at, used_at FROM loyalty_tokens WHERE token=? FOR UPDATE`
		arg = token
	} else {
		query = `SELECT id, order_id, points, expires_at, used_at FROM loyalty_tokens WHERE order_id=? ORDER BY id DESC LIMIT 1 FOR UPDATE`
		arg = orderID
	}
	if err := tx.Get(&lt, query, arg); err != nil {
		httpx.Error(w, http.StatusNotFound, "ไม่พบ token สะสมคะแนน")
		return
	}
	if lt.UsedAt.Valid {
		httpx.Error(w, http.StatusConflict, "QR นี้ถูกใช้ไปแล้ว")
		return
	}
	if time.Now().After(lt.ExpiresAt) {
		httpx.Error(w, http.StatusGone, "QR หมดอายุแล้ว")
		return
	}

	// Upsert customer by phone, add points.
	var customerID uint64
	err = tx.Get(&customerID, `SELECT id FROM customers WHERE phone=?`, in.Phone)
	if err == sql.ErrNoRows {
		res, e := tx.Exec(`INSERT INTO customers (phone, total_points) VALUES (?, 0)`, in.Phone)
		if e != nil {
			httpx.Error(w, http.StatusInternalServerError, "failed to create customer")
			return
		}
		cid, _ := res.LastInsertId()
		customerID = uint64(cid)
	} else if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "customer lookup failed")
		return
	}

	if _, err := tx.Exec(
		`UPDATE customers SET total_points = total_points + ? WHERE id=?`, lt.Points, customerID); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "failed to add points")
		return
	}
	if _, err := tx.Exec(
		`INSERT INTO point_transactions (customer_id, order_id, type, points, note)
		 VALUES (?, ?, 'earn', ?, 'earn from order')`, customerID, lt.OrderID, lt.Points); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "failed to log points")
		return
	}
	if _, err := tx.Exec(`UPDATE loyalty_tokens SET used_at=NOW() WHERE id=?`, lt.ID); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "failed to mark token used")
		return
	}
	if _, err := tx.Exec(`UPDATE orders SET customer_id=? WHERE id=?`, customerID, lt.OrderID); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "failed to link order")
		return
	}

	var totalPoints int
	_ = tx.Get(&totalPoints, `SELECT total_points FROM customers WHERE id=?`, customerID)

	if err := tx.Commit(); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "commit error")
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]any{
		"customer_id":   customerID,
		"phone":         in.Phone,
		"earned_points": lt.Points,
		"total_points":  totalPoints,
	})
}

func (h *PaymentHandler) lookupToken(q sqlx.Queryer, token string) (*loyaltyTokenInfo, error) {
	var row struct {
		Token       string       `db:"token"`
		OrderID     uint64       `db:"order_id"`
		OrderNumber string       `db:"order_number"`
		Points      int          `db:"points"`
		ExpiresAt   time.Time    `db:"expires_at"`
		UsedAt      sql.NullTime `db:"used_at"`
	}
	err := sqlx.Get(q,
		&row,
		`SELECT lt.token, lt.order_id, o.order_number, lt.points, lt.expires_at, lt.used_at
		 FROM loyalty_tokens lt JOIN orders o ON o.id = lt.order_id
		 WHERE lt.token=?`, token)
	if err != nil {
		return nil, err
	}
	info := &loyaltyTokenInfo{
		Token: row.Token, OrderID: row.OrderID, OrderNumber: row.OrderNumber, Points: row.Points, Valid: true,
	}
	if row.UsedAt.Valid {
		info.Valid = false
		info.Reason = "used"
	} else if time.Now().After(row.ExpiresAt) {
		info.Valid = false
		info.Reason = "expired"
	}
	return info, nil
}

// newToken returns a random UUIDv4 string.
func newToken() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}
