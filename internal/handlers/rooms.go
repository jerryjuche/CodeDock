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

func (h *RoomHandler) RoomsRouter(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.GetUserRooms(w, r)
	case http.MethodPost:
		h.CreateRoom(w, r)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func (h *RoomHandler) RoomSpecificRouter(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.GetRoom(w, r)
	case http.MethodDelete:
		h.DeleteRoom(w, r)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
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

	roomID := r.PathValue("roomId")
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
	if r.Method != http.MethodGet {
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

	connectedUserIDs := h.Hub.ConnectedUserIDs(roomID)
	details, err := h.Services.GetRoomDetails(roomID, claims.UserID, connectedUserIDs)
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
	if r.Method != http.MethodGet {
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

	var req bindLocalWorkspaceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil && !errors.Is(err, http.ErrBodyNotAllowed) {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	connectedUserIDs := h.Hub.ConnectedUserIDs(roomID)
	details, err := h.Services.MarkLocalWorkspaceBound(roomID, claims.UserID, req.WorkspaceLabel, connectedUserIDs)
	if err == nil && h.Hub != nil {
		h.Hub.BroadcastAll(roomID, []byte{hub.MessageTypeRoomUpdate})
	}
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

func (h *RoomHandler) ToggleRoomActivation(w http.ResponseWriter, r *http.Request) {
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

	connectedUserIDs := h.Hub.ConnectedUserIDs(roomID)
	details, err := h.Services.ToggleRoomActivation(roomID, claims.UserID, connectedUserIDs)
	if err == nil && h.Hub != nil {
		h.Hub.BroadcastAll(roomID, []byte{hub.MessageTypeRoomUpdate})
	}
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

func (h *RoomHandler) GetRoomActivities(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
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

	// Check if user is a room member
	member, err := h.Services.IsRoomMember(roomID, claims.UserID)
	if err != nil {
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	if !member {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}

	// Get activities for the room
	activities, err := services.GetRoomActivities(h.Services.GetDB(), roomID, 100)
	if err != nil {
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, activities)
}

func (h *RoomHandler) LeaveRoom(w http.ResponseWriter, r *http.Request) {
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
	log.Printf("codedock: LeaveRoom request received for roomID=%s method=%s path=%s", roomID, r.Method, r.URL.Path)
	if roomID == "" {
		http.Error(w, "room ID cannot be empty", http.StatusBadRequest)
		return
	}

	err := h.Services.LeaveRoom(roomID, claims.UserID)
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
		h.Hub.BroadcastAll(roomID, []byte{hub.MessageTypeRoomUpdate})
		// Force close the connection for this user in this room
		h.Hub.CloseUserInRoom(roomID, claims.UserID)
	}

	writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}

func (h *RoomHandler) DeleteRoom(w http.ResponseWriter, r *http.Request) {
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
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
