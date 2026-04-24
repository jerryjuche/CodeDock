package handlers

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/jerryjuche/CodeDock/internal/auth"
	"github.com/jerryjuche/CodeDock/internal/services"
)

type RoomHandler struct {
	Services *services.RoomService
}

type createRoomRequest struct {
	Name           string          `json:"name"`
	SourceType     string          `json:"source_type"`
	SourceMetadata json.RawMessage `json:"source_metadata"`
}

func (h *RoomHandler) CreateRoom(w http.ResponseWriter, r *http.Request) {
	claims, ok := auth.GetUserFromContext(r)
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var req createRoomRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	room, err := h.Services.CreateRoomWithOptions(claims.UserID, services.CreateRoomInput{
		Name:           req.Name,
		SourceType:     req.SourceType,
		SourceMetadata: req.SourceMetadata,
	})
	if err != nil {
		switch {
		case errors.Is(err, services.ErrRoomNameRequired):
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		case errors.Is(err, services.ErrInvalidSource):
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		default:
			http.Error(w, "could not create room", http.StatusInternalServerError)
			return
		}
	}

	writeJSON(w, http.StatusCreated, room)
}

func (h *RoomHandler) GetRoom(w http.ResponseWriter, r *http.Request) {
	claims, ok := auth.GetUserFromContext(r)
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	roomID := r.PathValue("id")
	if roomID == "" {
		http.Error(w, "room ID cannot be empty", http.StatusBadRequest)
		return
	}

	member, err := h.Services.IsRoomMember(roomID, claims.UserID)
	if err != nil {
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	if !member {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}

	room, err := h.Services.GetRoom(roomID)
	if err != nil {
		if errors.Is(err, services.ErrRoomNotFound) {
			http.Error(w, "room not found", http.StatusNotFound)
			return
		}
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, room)
}

func (h *RoomHandler) GetUserRooms(w http.ResponseWriter, r *http.Request) {
	claims, ok := auth.GetUserFromContext(r)
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	rooms, err := h.Services.GetUserRooms(claims.UserID)
	if err != nil {
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, rooms)
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}