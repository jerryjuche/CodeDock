package handlers

import (
	"errors"
	"net/http"

	"github.com/gorilla/websocket"
	"github.com/jerryjuche/CodeDock/internal/auth"
	"github.com/jerryjuche/CodeDock/internal/hub"
	"github.com/jerryjuche/CodeDock/internal/services"
)

// upgrader converts an HTTP connection into a WebSocket connection.
// CheckOrigin returns true to allow all origins during development.
// Lock this down before production.
var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		// This will be overridden by the instance-specific check in ServeWS
		return false
	},
}

type WSHandler struct {
	Hub *hub.Hub
	DB  interface {
		QueryRow(query string, args ...any) interface {
			Scan(dest ...any) error
		}
	}
}

type RoomAccessChecker interface {
	CanConnectToRoom(roomID, userID string) error
}

// ServeWS handles incoming WebSocket connection requests.
// Flow:
//  1. Validate JWT from query param
//  2. Validate room_id from query param
//  3. Upgrade HTTP → WebSocket
//  4. Register client with Hub
//  5. Launch readPump and writePump goroutines

func ServeWS(h *hub.Hub, access RoomAccessChecker, allowedOrigins []string) http.HandlerFunc {
	allowed := make(map[string]struct{}, len(allowedOrigins))
	for _, origin := range allowedOrigins {
		allowed[origin] = struct{}{}
	}

	return func(w http.ResponseWriter, r *http.Request) {
		tokenStr := r.URL.Query().Get("token")
		if tokenStr == "" {
			http.Error(w, "missing token", http.StatusUnauthorized)
			return
		}

		claims, err := auth.VerifyToken(tokenStr)
		if err != nil {
			http.Error(w, "invalid token", http.StatusUnauthorized)
			return
		}

		roomID := r.URL.Query().Get("room_id")
		if roomID == "" {
			http.Error(w, "missing room_id", http.StatusBadRequest)
			return
		}

		if err := access.CanConnectToRoom(roomID, claims.UserID); err != nil {
			if errors.Is(err, services.ErrRoomNotActivated) {
				http.Error(w, "room_not_activated", http.StatusForbidden)
				return
			}
			http.Error(w, "room unavailable", http.StatusForbidden)
			return
		}

		u := upgrader
		u.CheckOrigin = func(r *http.Request) bool {
			origin := r.Header.Get("Origin")
			if origin == "" {
				return false
			}
			_, ok := allowed[origin]
			return ok
		}

		conn, err := u.Upgrade(w, r, nil)
		if err != nil {
			return
		}

		client := &hub.Client{
			Conn:   conn,
			Send:   make(chan []byte, 256),
			RoomID: roomID,
			UserID: claims.UserID,
		}
		h.Register(client)

		go client.WritePump()
		client.ReadPump(h)
	}
}
