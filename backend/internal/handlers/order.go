package handlers

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/jmoiron/sqlx"

	"github.com/croffy-crush/backend/internal/httpx"
	"github.com/croffy-crush/backend/internal/middleware"
	"github.com/croffy-crush/backend/internal/models"
)

// OrderHandler manages order lifecycle: create, kitchen queue, status, detail, search.
type OrderHandler struct {
	db *sqlx.DB
}

func NewOrderHandler(db *sqlx.DB) *OrderHandler {
	return &OrderHandler{db: db}
}

type createOrderItemInput struct {
	MenuItemID uint64   `json:"menu_item_id"`
	Quantity   int      `json:"quantity"`
	Note       *string  `json:"note"`
	AddonIDs   []uint64 `json:"addon_ids"`
}

type createOrderInput struct {
	OrderType string                 `json:"order_type"`
	Discount  float64                `json:"discount"`
	Items     []createOrderItemInput `json:"items"`
}

// OrderDetail is the full order with items and add-ons.
type OrderDetail struct {
	models.Order
	CustomerPhone *string           `json:"customer_phone"`
	Items         []OrderItemDetail `json:"items"`
}

type OrderItemDetail struct {
	models.OrderItem
	Addons []models.OrderItemAddon `json:"addons"`
}

// CreateOrder validates against the DB, computes totals, and persists the order.
func (h *OrderHandler) CreateOrder(w http.ResponseWriter, r *http.Request) {
	var in createOrderInput
	if err := httpx.Decode(r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid body")
		return
	}
	if in.OrderType != "dine_in" && in.OrderType != "takeaway" {
		httpx.Error(w, http.StatusBadRequest, "order_type must be dine_in or takeaway")
		return
	}
	if len(in.Items) == 0 {
		httpx.Error(w, http.StatusBadRequest, "order must have at least one item")
		return
	}

	tx, err := h.db.Beginx()
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "tx error")
		return
	}
	defer tx.Rollback()

	var subtotal float64
	type preparedItem struct {
		name      string
		unitPrice float64
		qty       int
		note      *string
		addons    []models.Addon
		addonsSum float64
	}
	prepared := make([]preparedItem, 0, len(in.Items))

	for _, it := range in.Items {
		if it.Quantity <= 0 {
			httpx.Error(w, http.StatusBadRequest, "quantity must be > 0")
			return
		}
		var mi models.MenuItem
		if err := tx.Get(&mi,
			`SELECT id, name, price FROM menu_items WHERE id=? AND is_active=1`, it.MenuItemID); err != nil {
			httpx.Error(w, http.StatusBadRequest, fmt.Sprintf("menu item %d not available", it.MenuItemID))
			return
		}

		var addons []models.Addon
		var addonsSum float64
		if len(it.AddonIDs) > 0 {
			q, args, _ := sqlx.In(
				`SELECT id, name, price FROM addons WHERE is_active=1 AND id IN (?)`, it.AddonIDs)
			q = tx.Rebind(q)
			if err := tx.Select(&addons, q, args...); err != nil {
				httpx.Error(w, http.StatusInternalServerError, "addon error")
				return
			}
			for _, a := range addons {
				addonsSum += a.Price
			}
		}

		lineTotal := (mi.Price + addonsSum) * float64(it.Quantity)
		subtotal += lineTotal
		prepared = append(prepared, preparedItem{
			name: mi.Name, unitPrice: mi.Price, qty: it.Quantity,
			note: it.Note, addons: addons, addonsSum: addonsSum,
		})
	}

	discount := in.Discount
	if discount < 0 {
		discount = 0
	}
	total := subtotal - discount
	if total < 0 {
		total = 0
	}

	orderNumber, err := nextOrderNumber(tx)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not generate order number")
		return
	}

	var createdBy *uint64
	if claims, ok := middleware.UserFromContext(r.Context()); ok {
		createdBy = &claims.UserID
	}

	res, err := tx.Exec(
		`INSERT INTO orders (order_number, order_type, status, payment_status, subtotal, discount, total, created_by)
		 VALUES (?, ?, 'pending', 'unpaid', ?, ?, ?, ?)`,
		orderNumber, in.OrderType, subtotal, discount, total, createdBy)
	if err != nil {
		log.Printf("create order insert failed (order_number=%s): %v", orderNumber, err)
		httpx.Error(w, http.StatusInternalServerError, "failed to create order")
		return
	}
	orderID, _ := res.LastInsertId()

	for i, p := range prepared {
		lineTotal := (p.unitPrice + p.addonsSum) * float64(p.qty)
		ir, err := tx.Exec(
			`INSERT INTO order_items (order_id, menu_item_id, item_name, unit_price, quantity, addons_total, line_total, note)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			orderID, in.Items[i].MenuItemID, p.name, p.unitPrice, p.qty, p.addonsSum, lineTotal, p.note)
		if err != nil {
			httpx.Error(w, http.StatusInternalServerError, "failed to create item")
			return
		}
		itemID, _ := ir.LastInsertId()
		for _, a := range p.addons {
			if _, err := tx.Exec(
				`INSERT INTO order_item_addons (order_item_id, addon_id, addon_name, price)
				 VALUES (?, ?, ?, ?)`, itemID, a.ID, a.Name, a.Price); err != nil {
				httpx.Error(w, http.StatusInternalServerError, "failed to create addon")
				return
			}
		}
	}

	if err := tx.Commit(); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "commit error")
		return
	}

	h.writeOrderDetail(w, uint64(orderID))
}

// nextOrderNumber builds YYYYMMDD-#### scoped to the current day.
// It derives the next sequence from the highest existing suffix (not COUNT)
// so deleted/cancelled orders never cause a duplicate order_number collision.
func nextOrderNumber(tx *sqlx.Tx) (string, error) {
	today := time.Now().Format("20060102")
	var maxSuffix sql.NullInt64
	if err := tx.Get(&maxSuffix,
		`SELECT MAX(CAST(SUBSTRING(order_number, 10) AS UNSIGNED))
		 FROM orders WHERE order_number LIKE ?`, today+"-%"); err != nil {
		return "", err
	}
	next := int64(1)
	if maxSuffix.Valid {
		next = maxSuffix.Int64 + 1
	}
	return fmt.Sprintf("%s-%04d", today, next), nil
}

// ListKitchen returns orders that still need to be prepared.
func (h *OrderHandler) ListKitchen(w http.ResponseWriter, r *http.Request) {
	orders := []models.Order{}
	if err := h.db.Select(&orders,
		`SELECT * FROM orders WHERE status IN ('pending','in_kitchen') ORDER BY created_at ASC`); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "failed to load kitchen")
		return
	}
	result := make([]OrderDetail, 0, len(orders))
	for _, o := range orders {
		d, err := h.loadDetail(o.ID)
		if err != nil {
			httpx.Error(w, http.StatusInternalServerError, "failed to load detail")
			return
		}
		result = append(result, *d)
	}
	httpx.JSON(w, http.StatusOK, result)
}

type updateStatusInput struct {
	Status string `json:"status"`
}

// UpdateStatus moves an order through pending -> in_kitchen -> done.
func (h *OrderHandler) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		httpx.Error(w, http.StatusBadRequest, "invalid id")
		return
	}
	var in updateStatusInput
	if err := httpx.Decode(r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid body")
		return
	}
	switch in.Status {
	case "pending", "in_kitchen", "cancelled":
		if _, err := h.db.Exec(`UPDATE orders SET status=? WHERE id=?`, in.Status, id); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "update failed")
			return
		}
	case "done":
		if _, err := h.db.Exec(
			`UPDATE orders SET status='done', completed_at=NOW() WHERE id=?`, id); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "update failed")
			return
		}
	default:
		httpx.Error(w, http.StatusBadRequest, "invalid status")
		return
	}
	h.writeOrderDetail(w, id)
}

// GetOrder returns a single order's full detail.
func (h *OrderHandler) GetOrder(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		httpx.Error(w, http.StatusBadRequest, "invalid id")
		return
	}
	h.writeOrderDetail(w, id)
}

// SearchByDate lists orders for a given ?date=YYYY-MM-DD.
func (h *OrderHandler) SearchByDate(w http.ResponseWriter, r *http.Request) {
	date := r.URL.Query().Get("date")
	if date == "" {
		date = time.Now().Format("2006-01-02")
	}
	orders := []models.Order{}
	if err := h.db.Select(&orders,
		`SELECT * FROM orders WHERE DATE(created_at) = ? ORDER BY created_at DESC`, date); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "search failed")
		return
	}
	httpx.JSON(w, http.StatusOK, orders)
}

func (h *OrderHandler) writeOrderDetail(w http.ResponseWriter, id uint64) {
	d, err := h.loadDetail(id)
	if err == sql.ErrNoRows {
		httpx.Error(w, http.StatusNotFound, "order not found")
		return
	}
	if err != nil {
		log.Printf("loadDetail(%d) failed: %v", id, err)
		httpx.Error(w, http.StatusInternalServerError, "failed to load order")
		return
	}
	httpx.JSON(w, http.StatusOK, d)
}

func (h *OrderHandler) loadDetail(id uint64) (*OrderDetail, error) {
	var o models.Order
	if err := h.db.Get(&o, `SELECT * FROM orders WHERE id=?`, id); err != nil {
		return nil, err
	}
	detail := &OrderDetail{Order: o, Items: []OrderItemDetail{}}

	if o.CustomerID != nil {
		var phone string
		if err := h.db.Get(&phone, `SELECT phone FROM customers WHERE id=?`, *o.CustomerID); err == nil {
			detail.CustomerPhone = &phone
		}
	}

	items := []models.OrderItem{}
	if err := h.db.Select(&items, `SELECT * FROM order_items WHERE order_id=?`, id); err != nil {
		return nil, err
	}
	for _, it := range items {
		addons := []models.OrderItemAddon{}
		if err := h.db.Select(&addons,
			`SELECT * FROM order_item_addons WHERE order_item_id=?`, it.ID); err != nil {
			return nil, err
		}
		detail.Items = append(detail.Items, OrderItemDetail{OrderItem: it, Addons: addons})
	}
	return detail, nil
}
