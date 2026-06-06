package handlers

import (
	"net/http"

	"github.com/jmoiron/sqlx"

	"github.com/croffy-crush/backend/internal/httpx"
)

// ReportHandler produces daily/weekly/monthly sales reports.
type ReportHandler struct {
	db *sqlx.DB
}

func NewReportHandler(db *sqlx.DB) *ReportHandler {
	return &ReportHandler{db: db}
}

type reportBucket struct {
	Label  string  `db:"label" json:"label"`
	Orders int     `db:"orders" json:"orders"`
	Sales  float64 `db:"sales" json:"sales"`
}

type reportMenu struct {
	ItemName string  `db:"item_name" json:"item_name"`
	Qty      int     `db:"qty" json:"qty"`
	Total    float64 `db:"total" json:"total"`
}

type reportResponse struct {
	Period  string         `json:"period"`
	Buckets []reportBucket `json:"buckets"`
	Menus   []reportMenu   `json:"menus"`
	Total   float64        `json:"total"`
}

// Report returns trends and a menu breakdown for ?period=daily|weekly|monthly.
func (h *ReportHandler) Report(w http.ResponseWriter, r *http.Request) {
	period := r.URL.Query().Get("period")

	var bucketQ, menuFilter string
	switch period {
	case "weekly":
		bucketQ = `SELECT DATE_FORMAT(MIN(created_at), '%Y-W%v') AS label, COUNT(*) AS orders, COALESCE(SUM(total),0) AS sales
		           FROM orders WHERE payment_status='paid' AND created_at >= DATE_SUB(CURDATE(), INTERVAL 8 WEEK)
		           GROUP BY YEARWEEK(created_at, 3) ORDER BY YEARWEEK(created_at, 3) ASC`
		menuFilter = `YEARWEEK(o.created_at, 3) = YEARWEEK(CURDATE(), 3)`
	case "monthly":
		bucketQ = `SELECT DATE_FORMAT(created_at, '%Y-%m') AS label, COUNT(*) AS orders, COALESCE(SUM(total),0) AS sales
		           FROM orders WHERE payment_status='paid' AND created_at >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
		           GROUP BY DATE_FORMAT(created_at, '%Y-%m') ORDER BY DATE_FORMAT(created_at, '%Y-%m') ASC`
		menuFilter = `DATE_FORMAT(o.created_at, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')`
	default:
		period = "daily"
		bucketQ = `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS label, COUNT(*) AS orders, COALESCE(SUM(total),0) AS sales
		           FROM orders WHERE payment_status='paid' AND created_at >= DATE_SUB(CURDATE(), INTERVAL 14 DAY)
		           GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d') ORDER BY DATE_FORMAT(created_at, '%Y-%m-%d') ASC`
		menuFilter = `DATE(o.created_at) = CURDATE()`
	}

	resp := reportResponse{Period: period, Buckets: []reportBucket{}, Menus: []reportMenu{}}

	if err := h.db.Select(&resp.Buckets, bucketQ); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "failed to load buckets")
		return
	}

	menuQ := `SELECT oi.item_name, SUM(oi.quantity) AS qty, SUM(oi.line_total) AS total
	          FROM order_items oi JOIN orders o ON o.id = oi.order_id
	          WHERE o.payment_status='paid' AND ` + menuFilter + `
	          GROUP BY oi.item_name ORDER BY total DESC`
	if err := h.db.Select(&resp.Menus, menuQ); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "failed to load menu breakdown")
		return
	}
	for _, m := range resp.Menus {
		resp.Total += m.Total
	}

	httpx.JSON(w, http.StatusOK, resp)
}
