package models

import "time"

// MenuItem is a sellable product.
type MenuItem struct {
	ID          uint64    `db:"id" json:"id"`
	Name        string    `db:"name" json:"name"`
	Description *string   `db:"description" json:"description"`
	Price       float64   `db:"price" json:"price"`
	ImageURL    *string   `db:"image_url" json:"image_url"`
	Category    *string   `db:"category" json:"category"`
	IsActive    bool      `db:"is_active" json:"is_active"`
	DisplayOrder int      `db:"display_order" json:"display_order"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time `db:"updated_at" json:"updated_at"`
}

// Addon is an optional topping/extra.
type Addon struct {
	ID        uint64    `db:"id" json:"id"`
	Name      string    `db:"name" json:"name"`
	Price     float64   `db:"price" json:"price"`
	IsActive  bool      `db:"is_active" json:"is_active"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
	UpdatedAt time.Time `db:"updated_at" json:"updated_at"`
}

// Reward is a redeemable loyalty reward.
type Reward struct {
	ID          uint64    `db:"id" json:"id"`
	Name        string    `db:"name" json:"name"`
	Description *string   `db:"description" json:"description"`
	PointsCost  int       `db:"points_cost" json:"points_cost"`
	ImageURL    *string   `db:"image_url" json:"image_url"`
	IsActive    bool      `db:"is_active" json:"is_active"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time `db:"updated_at" json:"updated_at"`
}

// Order is a customer order header.
type Order struct {
	ID            uint64     `db:"id" json:"id"`
	OrderNumber   string     `db:"order_number" json:"order_number"`
	OrderType     string     `db:"order_type" json:"order_type"`
	Status        string     `db:"status" json:"status"`
	PaymentStatus string     `db:"payment_status" json:"payment_status"`
	PaymentMethod *string    `db:"payment_method" json:"payment_method"`
	Subtotal      float64    `db:"subtotal" json:"subtotal"`
	Discount      float64    `db:"discount" json:"discount"`
	Total         float64    `db:"total" json:"total"`
	CustomerID    *uint64    `db:"customer_id" json:"customer_id"`
	CreatedBy     *uint64    `db:"created_by" json:"created_by"`
	PaidAt        *time.Time `db:"paid_at" json:"paid_at"`
	CompletedAt   *time.Time `db:"completed_at" json:"completed_at"`
	CreatedAt     time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt     time.Time  `db:"updated_at" json:"updated_at"`
}

// OrderItem is a line in an order.
type OrderItem struct {
	ID          uint64  `db:"id" json:"id"`
	OrderID     uint64  `db:"order_id" json:"order_id"`
	MenuItemID  *uint64 `db:"menu_item_id" json:"menu_item_id"`
	ItemName    string  `db:"item_name" json:"item_name"`
	UnitPrice   float64 `db:"unit_price" json:"unit_price"`
	Quantity    int     `db:"quantity" json:"quantity"`
	AddonsTotal float64 `db:"addons_total" json:"addons_total"`
	LineTotal   float64 `db:"line_total" json:"line_total"`
	Note        *string `db:"note" json:"note"`
}

// OrderItemAddon is a snapshot of an add-on chosen for an order item.
type OrderItemAddon struct {
	ID          uint64  `db:"id" json:"id"`
	OrderItemID uint64  `db:"order_item_id" json:"order_item_id"`
	AddonID     *uint64 `db:"addon_id" json:"addon_id"`
	AddonName   string  `db:"addon_name" json:"addon_name"`
	Price       float64 `db:"price" json:"price"`
}

// Customer is a loyalty member identified by phone.
type Customer struct {
	ID          uint64    `db:"id" json:"id"`
	Phone       string    `db:"phone" json:"phone"`
	Name        *string   `db:"name" json:"name"`
	TotalPoints int       `db:"total_points" json:"total_points"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time `db:"updated_at" json:"updated_at"`
}
