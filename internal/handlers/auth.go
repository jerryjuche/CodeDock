package handlers

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/jerryjuche/CodeDock/internal/auth"
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

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), 12)
	if err != nil {
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	// Delegate to service layer — business logic lives there, not here
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

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(authResponse{
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

	//check for empty mail and password
	if req.Email == "" || req.Password == "" {
		http.Error(w, "email and password are required", http.StatusBadRequest)
		return
	}

	// fetch users from db by email
	var userID, passwordHash string

	err := h.DB.QueryRow(`SELECT id, password_hash FROM users WHERE email = $1`, req.Email).Scan(&userID, &passwordHash)

	if err == sql.ErrNoRows {
		http.Error(w, "invalid credentials", http.StatusUnauthorized)
		return
	}

	if err != nil {
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	// compare hashed password
	if err = bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(req.Password)); err != nil {
		http.Error(w, "invalid credentials", http.StatusUnauthorized)
		return
	}

	// generate token
	token, err := auth.GenerateToken(userID, req.Email)
	if err != nil {
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(authResponse{
		Token: token,
		Email: req.Email,
	})
}

func (h *AuthHandler) ExchangeCode(w http.ResponseWriter, r *http.Request) {

	var Det struct {
		DB   sql.DB
		Code string `json:"code"`
	}

	if err := json.NewDecoder(r.Body).Decode(&Det); err != nil {
		http.Error(w, "Error Fetching results", http.StatusInternalServerError)
		return
	}

	details, err := services.ExchangeInviteCode(Det.Code)

	if err == sql.ErrNoRows {
		http.Error(w, "Invalid Invitation Code", http.StatusGone)
		return
	}

	if err != nil {
		http.Error(w, "Invalid Invitation Code", http.StatusGone)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(code:Det.Code)

}
