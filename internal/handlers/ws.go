package handlers

import (
	"net/http"

	"github.com/gorilla/websocket"
	"github.com/jerryjuche/CodeDock/internal/auth"
	"github.com/jerryjuche/CodeDock/internal/hub"
)

// upgrader converts an HTTP connection into a WebSocket connection.
// CheckOrigin returns true to allow all origins during development.
// Lock this down before production.
var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
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

// ServeWS handles incoming WebSocket connection requests.
// Flow:
//  1. Validate JWT from query param
//  2. Validate room_id from query param
//  3. Upgrade HTTP → WebSocket
//  4. Register client with Hub
//  5. Launch readPump and writePump goroutines
func ServeWS(h *hub.Hub) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Step 1 — validate JWT from query param
		// WebSocket connections cannot send headers after the handshake,
		// so the token travels as a query parameter instead
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

		// Step 2 — validate room_id
		roomID := r.URL.Query().Get("room_id")
		if roomID == "" {
			http.Error(w, "missing room_id", http.StatusBadRequest)
			return
		}

		// Step 3 — upgrade HTTP connection to WebSocket
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			// Upgrade writes its own error response on failure
			return
		}

		// Step 4 — create client and register with Hub
		client := &hub.Client{
			Conn:   conn,
			Send:   make(chan []byte, 256),
			RoomID: roomID,
			UserID: claims.UserID,
		}
		h.Register(client)

		// Step 5 — launch goroutines
		// writePump runs in a goroutine — it blocks on the send channel
		// readPump runs in the current goroutine — it blocks on the connection
		go client.WritePump()
		client.ReadPump(h)
	}
}
