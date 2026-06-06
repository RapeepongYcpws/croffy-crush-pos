package handlers

import (
	"database/sql"
	"net/http"
	"strconv"
	"strings"

	"github.com/jmoiron/sqlx"

	"github.com/croffy-crush/backend/internal/httpx"
	"github.com/croffy-crush/backend/internal/models"
)

// MenuHandler manages menu items and add-ons.
type MenuHandler struct {
	db *sqlx.DB
}

func NewMenuHandler(db *sqlx.DB) *MenuHandler {
	return &MenuHandler{db: db}
}

func pathID(r *http.Request) (uint64, bool) {
	idStr := r.PathValue("id")
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		return 0, false
	}
	return id, true
}

type menuItemInput struct {
	Name        string  `json:"name"`
	Description *string `json:"description"`
	Price       float64 `json:"price"`
	ImageURL    *string `json:"image_url"`
	Category    *string `json:"category"`
	IsActive    *bool   `json:"is_active"`
}

// ListMenuItems returns all menu items (optionally only active via ?active=1).
func (h *MenuHandler) ListMenuItems(w http.ResponseWriter, r *http.Request) {
	items := []models.MenuItem{}
	query := `SELECT id, name, description, price, image_url, category, is_active, display_order, created_at, updated_at
	          FROM menu_items`
	if r.URL.Query().Get("active") == "1" {
		query += ` WHERE is_active = 1`
	}
	query += ` ORDER BY display_order ASC, id ASC`
	if err := h.db.Select(&items, query); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "failed to load menu")
		return
	}
	httpx.JSON(w, http.StatusOK, items)
}

func (h *MenuHandler) CreateMenuItem(w http.ResponseWriter, r *http.Request) {
	var in menuItemInput
	if err := httpx.Decode(r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid body")
		return
	}
	if strings.TrimSpace(in.Name) == "" {
		httpx.Error(w, http.StatusBadRequest, "name is required")
		return
	}
	active := true
	if in.IsActive != nil {
		active = *in.IsActive
	}
	res, err := h.db.Exec(
		`INSERT INTO menu_items (name, description, price, image_url, category, is_active, display_order)
		 VALUES (?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(display_order), 0) + 1 FROM menu_items AS m))`,
		in.Name, in.Description, in.Price, in.ImageURL, in.Category, active)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "failed to create")
		return
	}
	id, _ := res.LastInsertId()
	h.getMenuItem(w, uint64(id))
}

func (h *MenuHandler) UpdateMenuItem(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		httpx.Error(w, http.StatusBadRequest, "invalid id")
		return
	}
	var in menuItemInput
	if err := httpx.Decode(r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid body")
		return
	}
	active := true
	if in.IsActive != nil {
		active = *in.IsActive
	}
	_, err := h.db.Exec(
		`UPDATE menu_items SET name=?, description=?, price=?, image_url=?, category=?, is_active=?
		 WHERE id=?`,
		in.Name, in.Description, in.Price, in.ImageURL, in.Category, active, id)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "failed to update")
		return
	}
	h.getMenuItem(w, id)
}

func (h *MenuHandler) DeleteMenuItem(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		httpx.Error(w, http.StatusBadRequest, "invalid id")
		return
	}
	if _, err := h.db.Exec(`DELETE FROM menu_items WHERE id=?`, id); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "failed to delete")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]bool{"deleted": true})
}

func (h *MenuHandler) getMenuItem(w http.ResponseWriter, id uint64) {
	var item models.MenuItem
	err := h.db.Get(&item,
		`SELECT id, name, description, price, image_url, category, is_active, display_order, created_at, updated_at
		 FROM menu_items WHERE id=?`, id)
	if err == sql.ErrNoRows {
		httpx.Error(w, http.StatusNotFound, "not found")
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "failed to load")
		return
	}
	httpx.JSON(w, http.StatusOK, item)
}

type reorderInput struct {
	OrderedIDs []uint64 `json:"ordered_ids"`
}

// ReorderMenuItems persists a new display order from an ordered list of item IDs.
func (h *MenuHandler) ReorderMenuItems(w http.ResponseWriter, r *http.Request) {
	var in reorderInput
	if err := httpx.Decode(r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid body")
		return
	}
	if len(in.OrderedIDs) == 0 {
		httpx.Error(w, http.StatusBadRequest, "ordered_ids is required")
		return
	}
	tx, err := h.db.Beginx()
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "failed to reorder")
		return
	}
	for pos, id := range in.OrderedIDs {
		if _, err := tx.Exec(`UPDATE menu_items SET display_order=? WHERE id=?`, pos+1, id); err != nil {
			_ = tx.Rollback()
			httpx.Error(w, http.StatusInternalServerError, "failed to reorder")
			return
		}
	}
	if err := tx.Commit(); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "failed to reorder")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]bool{"reordered": true})
}

// ---- Add-ons ----

func (h *MenuHandler) ListAddons(w http.ResponseWriter, r *http.Request) {
	addons := []models.Addon{}
	query := `SELECT id, name, price, is_active, created_at, updated_at FROM addons`
	if r.URL.Query().Get("active") == "1" {
		query += ` WHERE is_active = 1`
	}
	query += ` ORDER BY id ASC`
	if err := h.db.Select(&addons, query); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "failed to load addons")
		return
	}
	httpx.JSON(w, http.StatusOK, addons)
}
