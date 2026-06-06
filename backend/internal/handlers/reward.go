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

// RewardHandler manages rewards and redemptions.
type RewardHandler struct {
	db *sqlx.DB
}

func NewRewardHandler(db *sqlx.DB) *RewardHandler {
	return &RewardHandler{db: db}
}

type rewardInput struct {
	Name        string  `json:"name"`
	Description *string `json:"description"`
	PointsCost  int     `json:"points_cost"`
	ImageURL    *string `json:"image_url"`
	IsActive    *bool   `json:"is_active"`
}

// ListRewards returns all rewards (management). Use ?active=1 for active only.
func (h *RewardHandler) ListRewards(w http.ResponseWriter, r *http.Request) {
	rewards := []models.Reward{}
	query := `SELECT id, name, description, points_cost, image_url, is_active, created_at, updated_at FROM rewards`
	if r.URL.Query().Get("active") == "1" {
		query += ` WHERE is_active = 1`
	}
	query += ` ORDER BY points_cost ASC`
	if err := h.db.Select(&rewards, query); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "failed to load rewards")
		return
	}
	httpx.JSON(w, http.StatusOK, rewards)
}

func (h *RewardHandler) CreateReward(w http.ResponseWriter, r *http.Request) {
	var in rewardInput
	if err := httpx.Decode(r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid body")
		return
	}
	if strings.TrimSpace(in.Name) == "" || in.PointsCost <= 0 {
		httpx.Error(w, http.StatusBadRequest, "name และ points_cost จำเป็น")
		return
	}
	active := true
	if in.IsActive != nil {
		active = *in.IsActive
	}
	res, err := h.db.Exec(
		`INSERT INTO rewards (name, description, points_cost, image_url, is_active)
		 VALUES (?, ?, ?, ?, ?)`,
		in.Name, in.Description, in.PointsCost, in.ImageURL, active)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "failed to create")
		return
	}
	id, _ := res.LastInsertId()
	h.getReward(w, uint64(id))
}

func (h *RewardHandler) UpdateReward(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		httpx.Error(w, http.StatusBadRequest, "invalid id")
		return
	}
	var in rewardInput
	if err := httpx.Decode(r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid body")
		return
	}
	active := true
	if in.IsActive != nil {
		active = *in.IsActive
	}
	_, err := h.db.Exec(
		`UPDATE rewards SET name=?, description=?, points_cost=?, image_url=?, is_active=? WHERE id=?`,
		in.Name, in.Description, in.PointsCost, in.ImageURL, active, id)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "failed to update")
		return
	}
	h.getReward(w, id)
}

func (h *RewardHandler) DeleteReward(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		httpx.Error(w, http.StatusBadRequest, "invalid id")
		return
	}
	if _, err := h.db.Exec(`DELETE FROM rewards WHERE id=?`, id); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "failed to delete")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]bool{"deleted": true})
}

func (h *RewardHandler) getReward(w http.ResponseWriter, id uint64) {
	var rw models.Reward
	err := h.db.Get(&rw,
		`SELECT id, name, description, points_cost, image_url, is_active, created_at, updated_at
		 FROM rewards WHERE id=?`, id)
	if err == sql.ErrNoRows {
		httpx.Error(w, http.StatusNotFound, "not found")
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "failed to load")
		return
	}
	httpx.JSON(w, http.StatusOK, rw)
}

type availableReward struct {
	models.Reward
	Affordable bool `json:"affordable"`
}

// ListAvailable returns active rewards with an affordability flag based on ?points=N.
func (h *RewardHandler) ListAvailable(w http.ResponseWriter, r *http.Request) {
	points, _ := strconv.Atoi(r.URL.Query().Get("points"))
	rewards := []models.Reward{}
	if err := h.db.Select(&rewards,
		`SELECT id, name, description, points_cost, image_url, is_active, created_at, updated_at
		 FROM rewards WHERE is_active = 1 ORDER BY points_cost ASC`); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "failed to load")
		return
	}
	out := make([]availableReward, 0, len(rewards))
	for _, rw := range rewards {
		out = append(out, availableReward{Reward: rw, Affordable: points >= rw.PointsCost})
	}
	httpx.JSON(w, http.StatusOK, out)
}

type redeemInput struct {
	CustomerID uint64 `json:"customer_id"`
	RewardID   uint64 `json:"reward_id"`
}

// Redeem deducts points and records a redemption.
func (h *RewardHandler) Redeem(w http.ResponseWriter, r *http.Request) {
	var in redeemInput
	if err := httpx.Decode(r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid body")
		return
	}

	tx, err := h.db.Beginx()
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "tx error")
		return
	}
	defer tx.Rollback()

	var customerPoints int
	if err := tx.Get(&customerPoints,
		`SELECT total_points FROM customers WHERE id=? FOR UPDATE`, in.CustomerID); err != nil {
		httpx.Error(w, http.StatusNotFound, "customer not found")
		return
	}
	var rw models.Reward
	if err := tx.Get(&rw,
		`SELECT id, name, points_cost FROM rewards WHERE id=? AND is_active=1`, in.RewardID); err != nil {
		httpx.Error(w, http.StatusNotFound, "reward not found")
		return
	}
	if customerPoints < rw.PointsCost {
		httpx.Error(w, http.StatusBadRequest, "คะแนนไม่เพียงพอ")
		return
	}

	if _, err := tx.Exec(
		`UPDATE customers SET total_points = total_points - ? WHERE id=?`, rw.PointsCost, in.CustomerID); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "failed to deduct")
		return
	}
	if _, err := tx.Exec(
		`INSERT INTO reward_redemptions (customer_id, reward_id, reward_name, points_used)
		 VALUES (?, ?, ?, ?)`, in.CustomerID, rw.ID, rw.Name, rw.PointsCost); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "failed to log redemption")
		return
	}
	if _, err := tx.Exec(
		`INSERT INTO point_transactions (customer_id, type, points, note)
		 VALUES (?, 'redeem', ?, ?)`, in.CustomerID, -rw.PointsCost, "redeem: "+rw.Name); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "failed to log points")
		return
	}

	var remaining int
	_ = tx.Get(&remaining, `SELECT total_points FROM customers WHERE id=?`, in.CustomerID)

	if err := tx.Commit(); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "commit error")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"redeemed":     rw.Name,
		"points_used":  rw.PointsCost,
		"total_points": remaining,
	})
}
