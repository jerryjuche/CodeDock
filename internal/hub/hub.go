package hub

import (
	"sync"

	"github.com/gorilla/websocket"
)

type SnapshotStore interface {
	Save(roomID, filePath string, state []byte) error
	Get(roomID, filePath string) ([]byte, error)
}

type snapshotKey struct {
	roomID   string
	filePath string
}

const snapshotThreshold = 50

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
	rooms     map[string]map[*Client]bool
	mu        sync.RWMutex
	snapshots SnapshotStore
	counts    map[snapshotKey]int
	countsMu  sync.Mutex
}

// New creates and returns an empty Hub.
func New(store SnapshotStore) *Hub {
	return &Hub{
		rooms:     make(map[string]map[*Client]bool),
		snapshots: store,
		counts:    make(map[snapshotKey]int),
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

	if len(room) == 0 {
		delete(h.rooms, client.RoomID)
	}
}

// Broadcast sends a message to all clients in a room except the sending connection.
func (h *Hub) Broadcast(sender *Client, roomID string, message []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	for client := range h.rooms[roomID] {
		if client == sender {
			continue
		}

		select {
		case client.Send <- message:
		default:
			// Client's send buffer is full — they are too slow or disconnected.
			// Drop rather than block the room.
		}
	}
}

// Route inspects the message type and dispatches accordingly.
func (h *Hub) Route(msg Message) {
	switch msg.Type {
	case MessageTypeSync:
		h.Broadcast(msg.Sender, msg.Sender.RoomID, append([]byte{MessageTypeSync}, msg.Payload...))
		h.trackAndSnapshot(msg)

	case MessageTypeAwareness:
		h.BroadcastAll(msg.Sender.RoomID, append([]byte{MessageTypeAwareness}, msg.Payload...))

	case MessageTypeChat:
		h.Broadcast(msg.Sender, msg.Sender.RoomID, append([]byte{MessageTypeChat}, msg.Payload...))

	case MessageTypeHydrationRequest:
		h.Broadcast(msg.Sender, msg.Sender.RoomID, append([]byte{MessageTypeHydrationRequest}, msg.Payload...))
	}
}

func (h *Hub) trackAndSnapshot(msg Message) {
	if h.snapshots == nil {
		return
	}

	if len(msg.Payload) < 4 {
		return
	}

	filePathLen := int(msg.Payload[0])<<8 | int(msg.Payload[1])

	if filePathLen == 0 || 2+filePathLen >= len(msg.Payload) {
		return
	}

	filePath := string(msg.Payload[2 : 2+filePathLen])
	yjsUpdate := msg.Payload[2+filePathLen:]

	key := snapshotKey{roomID: msg.Sender.RoomID, filePath: filePath}

	h.countsMu.Lock()
	h.counts[key]++
	count := h.counts[key]
	if count >= snapshotThreshold {
		h.counts[key] = 0
	}
	h.countsMu.Unlock()

	if count >= snapshotThreshold {
		go func() {
			_ = h.snapshots.Save(key.roomID, key.filePath, yjsUpdate)
		}()
	}
}

// BroadcastAll sends a message to every client in a room including the sender.
func (h *Hub) BroadcastAll(roomID string, message []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	for client := range h.rooms[roomID] {
		select {
		case client.Send <- message:
		default:
		}
	}
}