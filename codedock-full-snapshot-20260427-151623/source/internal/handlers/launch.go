package handlers

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/jerryjuche/CodeDock/internal/auth"
	"github.com/jerryjuche/CodeDock/internal/services"
)

type LaunchHandler struct {
	Service *services.LaunchService
}

type exchangeLaunchTokenRequest struct {
	LaunchToken string `json:"launch_token"`
}

func (h *LaunchHandler) OpenInVSCode(w http.ResponseWriter, r *http.Request) {
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

	response, err := h.Service.CreateRoomLaunch(roomID, claims.UserID)
	if err != nil {
		if errors.Is(err, services.ErrRoomForbidden) {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, response)
}

func (h *LaunchHandler) ExchangeLaunchToken(w http.ResponseWriter, r *http.Request) {
	var req exchangeLaunchTokenRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	context, err := h.Service.ExchangeLaunchToken(req.LaunchToken)
	if err != nil {
		switch {
		case errors.Is(err, services.ErrLaunchTokenInvalid):
			http.Error(w, "invalid launch token", http.StatusUnauthorized)
			return
		case errors.Is(err, services.ErrLaunchTokenExpired):
			http.Error(w, "launch token expired", http.StatusGone)
			return
		default:
			http.Error(w, "internal server error", http.StatusInternalServerError)
			return
		}
	}

	writeJSON(w, http.StatusOK, context)
}