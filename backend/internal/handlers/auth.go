package handlers

import (
	"database/sql"
	"net/http"
	"strings"

	"github.com/jmoiron/sqlx"
	"golang.org/x/crypto/bcrypt"

	"github.com/croffy-crush/backend/internal/auth"
	"github.com/croffy-crush/backend/internal/httpx"
	"github.com/croffy-crush/backend/internal/middleware"
	"github.com/croffy-crush/backend/internal/models"
)

// AuthHandler handles login and current-user endpoints.
type AuthHandler struct {
	db  *sqlx.DB
	jwt *auth.Manager
}

func NewAuthHandler(db *sqlx.DB, jwt *auth.Manager) *AuthHandler {
	return &AuthHandler{db: db, jwt: jwt}
}

type loginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type loginResponse struct {
	Token string       `json:"token"`
	User  *models.User `json:"user"`
}

// Login authenticates a user and returns a JWT.
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}
	req.Username = strings.TrimSpace(req.Username)
	if req.Username == "" || req.Password == "" {
		httpx.Error(w, http.StatusBadRequest, "username and password are required")
		return
	}

	var user models.User
	err := h.db.Get(&user,
		`SELECT id, username, password_hash, full_name, role, is_active, created_at, updated_at
		 FROM users WHERE username = ? AND is_active = 1`, req.Username)
	if err == sql.ErrNoRows {
		httpx.Error(w, http.StatusUnauthorized, "invalid credentials")
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database error")
		return
	}

	if bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)) != nil {
		httpx.Error(w, http.StatusUnauthorized, "invalid credentials")
		return
	}

	token, err := h.jwt.Generate(user.ID, user.Username, user.Role)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not issue token")
		return
	}

	httpx.JSON(w, http.StatusOK, loginResponse{Token: token, User: &user})
}

// Me returns the currently authenticated user's profile.
func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.UserFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var user models.User
	err := h.db.Get(&user,
		`SELECT id, username, password_hash, full_name, role, is_active, created_at, updated_at
		 FROM users WHERE id = ?`, claims.UserID)
	if err != nil {
		httpx.Error(w, http.StatusUnauthorized, "user not found")
		return
	}
	httpx.JSON(w, http.StatusOK, user)
}
