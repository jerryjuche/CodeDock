package handlers

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/jerryjuche/CodeDock/internal/auth"
	"github.com/jerryjuche/CodeDock/internal/hub"
	"github.com/jerryjuche/CodeDock/internal/services"
)

type LaunchHandler struct {
	Service *services.LaunchService
	Hub     *hub.Hub
}

type exchangeLaunchTokenRequest struct {
	LaunchToken string `json:"launch_token"`
}

type openIDERequest struct {
	Editor string `json:"editor"`
}

func (h *LaunchHandler) OpenInVSCode(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
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

func (h *LaunchHandler) OpenIDE(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
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

	var req openIDERequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if req.Editor == "" {
		http.Error(w, "editor field is required", http.StatusBadRequest)
		return
	}

	response, err := h.Service.CreateEditorLaunch(roomID, claims.UserID, req.Editor)
	if err != nil {
		switch {
		case errors.Is(err, services.ErrRoomForbidden):
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		case errors.Is(err, services.ErrInvalidEditor):
			http.Error(w, "invalid editor target", http.StatusBadRequest)
			return
		default:
			http.Error(w, "internal server error", http.StatusInternalServerError)
			return
		}
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

	if h.Hub != nil {
		h.Hub.BroadcastAll(context.RoomID, []byte{hub.MessageTypeRoomUpdate})
	}

	writeJSON(w, http.StatusOK, context)
}
