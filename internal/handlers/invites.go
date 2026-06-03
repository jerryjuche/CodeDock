package handlers

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/jerryjuche/CodeDock/internal/auth"
	"github.com/jerryjuche/CodeDock/internal/services"
)

type InviteHandler struct {
	Service *services.InviteService
}

type resolveJoinCodeRequest struct {
	Code string `json:"code"`
}

type createInviteRequest struct {
	ExpiresInHours *int `json:"expires_in_hours"`
	MaxUses        *int `json:"max_uses"`
}

func (h *InviteHandler) ResolveJoinCode(w http.ResponseWriter, r *http.Request) {
	claims, ok := auth.GetUserFromContext(r)
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var req resolveJoinCodeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	result, err := h.Service.ResolveJoinCodeForUser(req.Code, claims.UserID)
	if err != nil {
		switch {
		case errors.Is(err, services.ErrJoinCodeInvalid):
			http.Error(w, "invalid invite code", http.StatusNotFound)
			return
		case errors.Is(err, services.ErrJoinCodeExpired):
			http.Error(w, "Room invite code expired / revoked. Admin will have to generate a new token so you can join workspace.", http.StatusGone)
			return
		default:
			http.Error(w, "internal server error", http.StatusInternalServerError)
			return
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"room": result.Room,
		"membership": map[string]any{
			"role":   result.Role,
			"joined": result.Joined,
		},
	})
}

func (h *InviteHandler) ListRoomInvites(w http.ResponseWriter, r *http.Request) {
	claims, ok := auth.GetUserFromContext(r)
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	roomID := r.PathValue("roomId")
	if roomID == "" {
		http.Error(w, "room ID cannot be empty", http.StatusBadRequest)
		return
	}

	invites, err := h.Service.ListRoomInviteTokens(roomID, claims.UserID)
	if err != nil {
		if errors.Is(err, services.ErrRoomForbidden) {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, invites)
}

func (h *InviteHandler) CreateRoomInvite(w http.ResponseWriter, r *http.Request) {
	claims, ok := auth.GetUserFromContext(r)
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	roomID := r.PathValue("roomId")
	if roomID == "" {
		http.Error(w, "room ID cannot be empty", http.StatusBadRequest)
		return
	}

	var req createInviteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	invite, err := h.Service.CreateRoomInviteToken(roomID, claims.UserID, req.ExpiresInHours, req.MaxUses)
	if err != nil {
		switch {
		case errors.Is(err, services.ErrRoomForbidden):
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		case errors.Is(err, services.ErrInviteConfig):
			http.Error(w, "invalid invite configuration", http.StatusBadRequest)
			return
		default:
			http.Error(w, "internal server error", http.StatusInternalServerError)
			return
		}
	}

	writeJSON(w, http.StatusCreated, invite)
}

func (h *InviteHandler) RevokeRoomInvite(w http.ResponseWriter, r *http.Request) {
	claims, ok := auth.GetUserFromContext(r)
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	roomID := r.PathValue("roomId")
	inviteID := r.PathValue("inviteId")
	if roomID == "" || inviteID == "" {
		http.Error(w, "room ID and invite ID are required", http.StatusBadRequest)
		return
	}

	err := h.Service.RevokeRoomInviteToken(roomID, inviteID, claims.UserID)
	if err != nil {
		switch {
		case errors.Is(err, services.ErrRoomForbidden):
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		case errors.Is(err, services.ErrInviteNotFoundV2):
			http.Error(w, "invite not found", http.StatusNotFound)
			return
		default:
			http.Error(w, "internal server error", http.StatusInternalServerError)
			return
		}
	}

	writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}