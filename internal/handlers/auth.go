package handlers

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"regexp"

	"github.com/jerryjuche/CodeDock/internal/auth"
	"github.com/jerryjuche/CodeDock/internal/observability"
	"github.com/jerryjuche/CodeDock/internal/services"
	"golang.org/x/crypto/bcrypt"
)

type AuthHandler struct {
	DB *sql.DB
}

type registerRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type authResponse struct {
	Token string `json:"token"`
	Email string `json:"email"`
}

type meResponse struct {
	ID    string `json:"id"`
	Email string `json:"email"`
}

var emailRegex = regexp.MustCompile(`^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,15}$`)

func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req registerRequest

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if req.Email == "" || req.Password == "" {
		http.Error(w, "email and password are required", http.StatusBadRequest)
		return
	}

	if !emailRegex.MatchString(req.Email) {
		http.Error(w, "invalid email format", http.StatusBadRequest)
		return
	}

	if len(req.Password) < 8 {
		http.Error(w, "password must be at least 8 characters long", http.StatusBadRequest)
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), 12)
	if err != nil {
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	userID, err := services.CreateUser(h.DB, req.Email, string(hashedPassword))
	if err != nil {
		if errors.Is(err, services.ErrDuplicateEmail) {
			http.Error(w, "email already registered", http.StatusConflict)
			return
		}
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	token, err := auth.GenerateToken(userID, req.Email)
	if err != nil {
		http.Error(w, "could not generate token", http.StatusInternalServerError)
		return
	}

	observability.TrackEvent(userID, "backend_user_registered", map[string]interface{}{
		"email": req.Email,
	})

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)

	_ = json.NewEncoder(w).Encode(authResponse{
		Token: token,
		Email: req.Email,
	})
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req registerRequest

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if req.Email == "" || req.Password == "" {
		http.Error(w, "email and password are required", http.StatusBadRequest)
		return
	}

	var userID, passwordHash string

	err := h.DB.QueryRow(
		`SELECT id, password_hash FROM users WHERE email = $1`,
		req.Email,
	).Scan(&userID, &passwordHash)

	if err == sql.ErrNoRows {
		http.Error(w, "invalid credentials", http.StatusUnauthorized)
		return
	}

	if err != nil {
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	if err = bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(req.Password)); err != nil {
		http.Error(w, "invalid credentials", http.StatusUnauthorized)
		return
	}

	token, err := auth.GenerateToken(userID, req.Email)
	if err != nil {
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	observability.TrackEvent(userID, "backend_user_logged_in", map[string]interface{}{
		"email": req.Email,
	})

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)

	_ = json.NewEncoder(w).Encode(authResponse{
		Token: token,
		Email: req.Email,
	})
}

func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	claims, ok := auth.GetUserFromContext(r)
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)

	_ = json.NewEncoder(w).Encode(meResponse{
		ID:    claims.UserID,
		Email: claims.Email,
	})
}

// ExchangeCode is deprecated.
func (h *AuthHandler) ExchangeCode(w http.ResponseWriter, r *http.Request) {
	http.Error(
		w,
		"legacy invite exchange is deprecated; use /join-code/resolve from the web app",
		http.StatusGone,
	)
}