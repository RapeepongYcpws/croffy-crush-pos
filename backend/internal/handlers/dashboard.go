package handlers

import (
	"net/http"

	"github.com/jmoiron/sqlx"

	"github.com/croffy-crush/backend/internal/httpx"
)

// DashboardHandler exposes today's overview metrics.
type DashboardHandler struct {
	db *sqlx.DB
}

func NewDashboardHandler(db *sqlx.DB) *DashboardHandler {
	return &DashboardHandler{db: db}
}

type kitchenOrder struct {
	ID          uint64 `db:"id" json:"id"`
	OrderNumber string `db:"order_number" json:"order_number"`
	OrderType   string `db:"order_type" json:"order_type"`
	Status      string `db:"status" json:"status"`
}

type topMenu struct {
	ItemName string `db:"item_name" json:"item_name"`
	Qty      int    `db:"qty" json:"qty"`
}

type dashboardSummary struct {
	Sales         float64        `json:"sales"`
	OrderCount    int            `json:"order_count"`
	KitchenCount  int            `json:"kitchen_count"`
	KitchenOrders []kitchenOrder `json:"kitchen_orders"`
	TopMenus      []topMenu      `json:"top_menus"`
}

// Summary returns sales, order count, pending kitchen orders, and best sellers for today.
func (h *DashboardHandler) Summary(w http.ResponseWriter, r *http.Request) {
	var summary dashboardSummary

	if err := h.db.QueryRow(
		`SELECT COALESCE(SUM(total),0), COUNT(*)
		 FROM orders
		 WHERE payment_status = 'paid' AND DATE(created_at) = CURDATE()`,
	).Scan(&summary.Sales, &summary.OrderCount); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "failed to load sales")
		return
	}

	summary.KitchenOrders = []kitchenOrder{}
	if err := h.db.Select(&summary.KitchenOrders,
		`SELECT id, order_number, order_type, status
		 FROM orders
		 WHERE status IN ('pending','in_kitchen')
		 ORDER BY created_at ASC`); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "failed to load kitchen orders")
		return
	}
	summary.KitchenCount = len(summary.KitchenOrders)

	summary.TopMenus = []topMenu{}
	if err := h.db.Select(&summary.TopMenus,
		`SELECT oi.item_name, SUM(oi.quantity) AS qty
		 FROM order_items oi
		 JOIN orders o ON o.id = oi.order_id
		 WHERE DATE(o.created_at) = CURDATE() AND o.payment_status = 'paid'
		 GROUP BY oi.item_name
		 ORDER BY qty DESC
		 LIMIT 5`); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "failed to load top menus")
		return
	}

	httpx.JSON(w, http.StatusOK, summary)
}
