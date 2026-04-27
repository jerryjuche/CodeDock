package handlers

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"

	"github.com/jerryjuche/CodeDock/internal/auth"
	"github.com/jerryjuche/CodeDock/internal/hub"
	"github.com/jerryjuche/CodeDock/internal/services"
)

type RoomHandler struct {
	Services *services.RoomService
	Hub      *hub.Hub
}

type createRoomRequest struct {
	Name           string          `json:"name"`
	SourceType     string          `json:"source_type"`
	SourceMetadata json.RawMessage `json:"source_metadata"`
}

type bindLocalWorkspaceRequest struct {
	WorkspaceLabel string `json:"workspace_label"`
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

func (h *RoomHandler) GetRoomDetails(w http.ResponseWriter, r *http.Request) {
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

	details, err := h.Services.GetRoomDetails(roomID, claims.UserID)
	if err != nil {
		switch {
		case errors.Is(err, services.ErrRoomForbidden):
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		case errors.Is(err, services.ErrRoomNotFound):
			http.Error(w, "room not found", http.StatusNotFound)
			return
		default:
			http.Error(w, "internal server error", http.StatusInternalServerError)
			return
		}
	}

	writeJSON(w, http.StatusOK, details)
}

func (h *RoomHandler) GetRoomPresence(w http.ResponseWriter, r *http.Request) {
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

	connectedUserIDs := map[string]bool{}
	if h.Hub != nil {
		connectedUserIDs = h.Hub.ConnectedUserIDs(roomID)
	}

	presence, err := h.Services.GetRoomPresence(roomID, claims.UserID, connectedUserIDs)
	if err != nil {
		switch {
		case errors.Is(err, services.ErrRoomForbidden):
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		case errors.Is(err, services.ErrRoomNotFound):
			http.Error(w, "room not found", http.StatusNotFound)
			return
		default:
			http.Error(w, "internal server error", http.StatusInternalServerError)
			return
		}
	}

	writeJSON(w, http.StatusOK, presence)
}

func (h *RoomHandler) BindLocalWorkspace(w http.ResponseWriter, r *http.Request) {
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

	var req bindLocalWorkspaceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil && !errors.Is(err, http.ErrBodyNotAllowed) {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	details, err := h.Services.MarkLocalWorkspaceBound(roomID, claims.UserID, req.WorkspaceLabel)
	if err != nil {
		switch {
		case errors.Is(err, services.ErrRoomForbidden):
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		case errors.Is(err, services.ErrRoomNotFound):
			http.Error(w, "room not found", http.StatusNotFound)
			return
		case errors.Is(err, services.ErrInvalidRoomState):
			http.Error(w, "room is not a local workspace room", http.StatusBadRequest)
			return
		default:
			http.Error(w, "internal server error", http.StatusInternalServerError)
			return
		}
	}

	writeJSON(w, http.StatusOK, details)
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

func (h *RoomHandler) DeleteRoom(w http.ResponseWriter, r *http.Request) {
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

	err := h.Services.DeleteRoom(roomID, claims.UserID)
	if err != nil {
		switch {
		case errors.Is(err, services.ErrRoomForbidden):
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		case errors.Is(err, services.ErrRoomNotFound):
			http.Error(w, "room not found", http.StatusNotFound)
			return
		default:
			http.Error(w, "internal server error", http.StatusInternalServerError)
			return
		}
	}

	if h.Hub != nil {
		h.Hub.CloseRoom(roomID, 4004, "room_deleted")
	}

	writeJSON(w, http.StatusOK, map[string]bool{"success": true})

	log.Printf("codedock: delete room requested room_id=%s by user_id=%s", roomID, claims.UserID)
	if h.Hub != nil {
		log.Printf("codedock: closing live room room_id=%s", roomID)
		h.Hub.CloseRoom(roomID, 4004, "room_deleted")
	} else {
		log.Printf("codedock: hub is nil during room delete room_id=%s", roomID)
	}
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
