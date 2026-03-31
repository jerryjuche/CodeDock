package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/jerryjuche/CodeDock/internal/auth"
	"github.com/jerryjuche/CodeDock/internal/services"
)

type RoomHandler struct {
	services *services.RoomService
}

type createRoomRequest struct {
	Name string `json:"name"`
}

func (s *RoomHandler) CreateRoom(w http.ResponseWriter, r *http.Request) {
	var room createRoomRequest

	claims, ok := auth.GetUserFromContext(r)
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	if err := json.NewDecoder(r.Body).Decode(&room); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if room.Name == "" {
		http.Error(w, "Room name is required!!", http.StatusBadRequest)
		return

	}

	createdRoom, err := s.services.CreateRoom(claims.UserID, room.Name)
	if err != nil {
		http.Error(w, "could not create room", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(createdRoom)

}

func (s *RoomHandler) GetRoom(w http.ResponseWriter, r *http.Request) {

	roomID := r.PathValue("id")

	if roomID == "" {
		http.Error(w, "ID cannot be empty", http.StatusBadRequest)
		return
	}

	getRoom, err := s.services.GetRoom(roomID)
	if err != nil {
		if err.Error() == "no room found" {
			http.Error(w, "room not found", http.StatusNotFound)
			return
		}
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(getRoom)

}
