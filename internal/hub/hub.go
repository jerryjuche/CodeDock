package hub

import (
	"sync"

	"github.com/gorilla/websocket"
)

// Client represents a single connected developer.
// Each client belongs to one room and has a dedicated send channel.
type Client struct {
	Conn   *websocket.Conn
	Send   chan []byte
	RoomID string
	UserID string
}

// Hub is the central registry of all connected clients, organised by room.
// It is the only place where broadcast decisions are made.
type Hub struct {
	rooms map[string]map[*Client]bool
	mu    sync.RWMutex
}

// New creates and returns an empty Hub.
func New() *Hub {
	return &Hub{
		rooms: make(map[string]map[*Client]bool),
	}
}

// Register adds a client to its room.
func (h *Hub) Register(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if h.rooms[client.RoomID] == nil {
		h.rooms[client.RoomID] = make(map[*Client]bool)
	}
	h.rooms[client.RoomID][client] = true
}

// Unregister removes a client from its room and closes its send channel.
func (h *Hub) Unregister(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	room, ok := h.rooms[client.RoomID]
	if !ok {
		return
	}

	if _, exists := room[client]; exists {
		delete(room, client)
		close(client.Send)
	}

	// If the room is now empty, remove it from the map entirely
	if len(room) == 0 {
		delete(h.rooms, client.RoomID)
	}
}

// Broadcast sends a message to all clients in a room except the sender.
func (h *Hub) Broadcast(senderID string, roomID string, message []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	for client := range h.rooms[roomID] {
		if client.UserID == senderID {
			continue // don't echo back to sender
		}
		select {
		case client.Send <- message:
		default:
			// Client's send buffer is full — they are too slow or disconnected
			// We drop the message rather than block the entire broadcast
		}
	}
}
