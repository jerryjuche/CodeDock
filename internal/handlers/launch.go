package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/jerryjuche/CodeDock/internal/auth"
	"github.com/jerryjuche/CodeDock/internal/services"
)

type LaunchHandler struct {
	Service *services.LaunchService
}

type exchangeLaunchTokenRequest struct {
	LaunchToken string `json:"launch_token"`
}

type openIDERequest struct {
	Editor string `json:"editor"`
}

func getRequestBaseURL(r *http.Request) string {
	proto := "http"
	if forwardedProto := r.Header.Get("X-Forwarded-Proto"); forwardedProto != "" {
		proto = strings.TrimSpace(strings.Split(forwardedProto, ",")[0])
	} else if r.TLS != nil {
		proto = "https"
	}

	host := r.Header.Get("X-Forwarded-Host")
	if host == "" {
		host = r.Host
	}
	if host == "" {
		host = "localhost"
	}

	return fmt.Sprintf("%s://%s", proto, host)
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

	serverURL := getRequestBaseURL(r)

	response, err := h.Service.CreateRoomLaunch(roomID, claims.UserID, serverURL)
	if err != nil {
		switch {
		case errors.Is(err, services.ErrRoomForbidden):
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		case errors.Is(err, services.ErrRoomNotReady):
			http.Error(w, "room is not ready for launch", http.StatusConflict)
			return
		default:
			http.Error(w, "internal server error", http.StatusInternalServerError)
			return
		}
	}

	writeJSON(w, http.StatusOK, response)
}

func (h *LaunchHandler) OpenIDE(w http.ResponseWriter, r *http.Request) {
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

	serverURL := getRequestBaseURL(r)
	response, err := h.Service.CreateEditorLaunch(roomID, claims.UserID, req.Editor, serverURL)
	if err != nil {
		switch {
		case errors.Is(err, services.ErrRoomForbidden):
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		case errors.Is(err, services.ErrInvalidEditor):
			http.Error(w, "invalid editor target", http.StatusBadRequest)
			return
		case errors.Is(err, services.ErrRoomNotReady):
			http.Error(w, "room is not ready for launch", http.StatusConflict)
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

	writeJSON(w, http.StatusOK, context)
}
