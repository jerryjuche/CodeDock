package hub

import (
	"encoding/json"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

type SnapshotStore interface {
	Save(roomID, filePath string, state []byte) error
	Get(roomID, filePath string) ([]byte, error)
}

type ActivityStore interface {
	LogActivity(roomID, userID, activityType, filePath string, details map[string]interface{}) error
}

type snapshotKey struct {
	roomID   string
	filePath string
}

const snapshotThreshold = 50

type Client struct {
	Conn       *websocket.Conn
	Send       chan []byte
	RoomID     string
	UserID     string
	ClientType string
	// Bound indicates the client has successfully bound a workspace (local or hydrated).
	// The UI should consider the client "connected" only after this is true.
	Bound bool
}

type Hub struct {
	rooms      map[string]map[*Client]bool
	mu         sync.RWMutex
	snapshots  SnapshotStore
	activities ActivityStore
	counts     map[snapshotKey]int
	countsMu   sync.Mutex
}

func New(store SnapshotStore) *Hub {
	return &Hub{
		rooms:     make(map[string]map[*Client]bool),
		snapshots: store,
		counts:    make(map[snapshotKey]int),
	}
}

func NewWithActivityStore(store SnapshotStore, activityStore ActivityStore) *Hub {
	return &Hub{
		rooms:      make(map[string]map[*Client]bool),
		snapshots:  store,
		activities: activityStore,
		counts:     make(map[snapshotKey]int),
	}
}

// detectLanguage infers the programming language from file extension
func detectLanguage(filePath string) string {
	if strings.HasSuffix(filePath, ".go") {
		return "go"
	}
	if strings.HasSuffix(filePath, ".js") || strings.HasSuffix(filePath, ".ts") {
		return "javascript"
	}
	if strings.HasSuffix(filePath, ".py") {
		return "python"
	}
	if strings.HasSuffix(filePath, ".rs") {
		return "rust"
	}
	if strings.HasSuffix(filePath, ".java") {
		return "java"
	}
	if strings.HasSuffix(filePath, ".cpp") || strings.HasSuffix(filePath, ".cc") || strings.HasSuffix(filePath, ".cxx") {
		return "cpp"
	}
	if strings.HasSuffix(filePath, ".c") {
		return "c"
	}
	if strings.HasSuffix(filePath, ".html") {
		return "html"
	}
	if strings.HasSuffix(filePath, ".css") {
		return "css"
	}
	if strings.HasSuffix(filePath, ".json") {
		return "json"
	}
	if strings.HasSuffix(filePath, ".md") {
		return "markdown"
	}
	if strings.HasSuffix(filePath, ".sql") {
		return "sql"
	}
	return "text"
}

func (h *Hub) Register(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if h.rooms[client.RoomID] == nil {
		h.rooms[client.RoomID] = make(map[*Client]bool)
	}
	h.rooms[client.RoomID][client] = true
}

func (h *Hub) Unregister(client *Client) {
	h.mu.Lock()

	room, ok := h.rooms[client.RoomID]
	if !ok {
		h.mu.Unlock()
		return
	}

	if _, exists := room[client]; exists {
		delete(room, client)
		close(client.Send)
	}

	remaining := len(room)
	if remaining == 0 {
		delete(h.rooms, client.RoomID)
	}

	h.mu.Unlock()

	// Notify remaining clients so dashboards re-fetch presence/details
	if remaining > 0 {
		h.BroadcastAll(client.RoomID, []byte{MessageTypeRoomUpdate})
	}
}

func (h *Hub) CloseUserInRoom(roomID, userID string) {
	h.mu.Lock()
	defer h.mu.Unlock()

	room, ok := h.rooms[roomID]
	if !ok {
		return
	}

	for client := range room {
		if client.UserID == userID {
			delete(room, client)
			close(client.Send)
			_ = client.Conn.Close()
		}
	}

	if len(room) == 0 {
		delete(h.rooms, roomID)
	}
}

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
		}
	}
}

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

// ConnectedUserIDs returns IDs of users with a bound workspace.
// Counts both VS Code clients (vscode) and host dashboard clients (host).
func (h *Hub) ConnectedUserIDs(roomID string) map[string]bool {
	h.mu.RLock()
	defer h.mu.RUnlock()

	connected := make(map[string]bool)

	for client := range h.rooms[roomID] {
		if client.UserID == "" {
			continue
		}
		if client.ClientType != "vscode" && client.ClientType != "host" {
			continue
		}
		if client.Bound {
			connected[client.UserID] = true
		}
	}

	return connected
}

// SetClientBound marks a client as having bound its workspace.
// Applies to both VS Code and host dashboard clients.
func (h *Hub) SetClientBound(roomID, userID string) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if room, ok := h.rooms[roomID]; ok {
		for client := range room {
			if client.UserID == userID && (client.ClientType == "vscode" || client.ClientType == "host") {
				client.Bound = true
			}
		}
	}
}

func (h *Hub) Route(msg Message) {
	if msg.Sender != nil {
		h.mu.Lock()
		wasBound := msg.Sender.Bound
		msg.Sender.Bound = true
		h.mu.Unlock()

		if !wasBound {
			h.BroadcastAll(msg.Sender.RoomID, []byte{MessageTypeRoomUpdate})
		}
	}

	switch msg.Type {
	case MessageTypeSync:
		h.Broadcast(msg.Sender, msg.Sender.RoomID, append([]byte{MessageTypeSync}, msg.Payload...))
		h.trackSnapshot(msg)

	case MessageTypeFileActivity:
		// Legacy full-text activity payload.
		var payload struct {
			FilePath string `json:"filePath"`
			Content  string `json:"content"`
		}
		if err := json.Unmarshal(msg.Payload, &payload); err == nil {
			if h.activities != nil && msg.Sender.UserID != "" {
				details := map[string]interface{}{
					"code":     payload.Content,
					"language": detectLanguage(payload.FilePath),
				}
				go func() {
					_ = h.activities.LogActivity(
						msg.Sender.RoomID,
						msg.Sender.UserID,
						"file_edited",
						payload.FilePath,
						details,
					)
				}()
			}
		}

	case MessageTypeFileActivityIncr:
		// Incremental activity payload: only the changed range.
		var inc struct {
			FilePath    string `json:"filePath"`
			Start       int    `json:"start"`
			DeleteCount int    `json:"deleteCount"`
			Insert      string `json:"insert"`
		}
		if err := json.Unmarshal(msg.Payload, &inc); err == nil {
			if h.activities != nil && msg.Sender.UserID != "" {
				details := map[string]interface{}{
					"start":       inc.Start,
					"deleteCount": inc.DeleteCount,
					"insert":      inc.Insert,
					"language":    detectLanguage(inc.FilePath),
				}
				go func() {
					_ = h.activities.LogActivity(
						msg.Sender.RoomID,
						msg.Sender.UserID,
						"file_edited_incremental",
						inc.FilePath,
						details,
					)
				}()
			}
		}

	case MessageTypeAwareness:
		h.BroadcastAll(msg.Sender.RoomID, append([]byte{MessageTypeAwareness}, msg.Payload...))

	case MessageTypeChat:
		h.Broadcast(msg.Sender, msg.Sender.RoomID, append([]byte{MessageTypeChat}, msg.Payload...))

	case MessageTypeHydrationRequest:
		h.Broadcast(msg.Sender, msg.Sender.RoomID, append([]byte{MessageTypeHydrationRequest}, msg.Payload...))

	case MessageTypeWorkspaceManifestReq:
		h.Broadcast(msg.Sender, msg.Sender.RoomID, append([]byte{MessageTypeWorkspaceManifestReq}, msg.Payload...))

	case MessageTypeWorkspaceManifestRes:
		h.Broadcast(msg.Sender, msg.Sender.RoomID, append([]byte{MessageTypeWorkspaceManifestRes}, msg.Payload...))

	case MessageTypeFileBootstrapReq:
		h.Broadcast(msg.Sender, msg.Sender.RoomID, append([]byte{MessageTypeFileBootstrapReq}, msg.Payload...))

	case MessageTypeFileBootstrapRes:
		h.Broadcast(msg.Sender, msg.Sender.RoomID, append([]byte{MessageTypeFileBootstrapRes}, msg.Payload...))
	}
}

func (h *Hub) trackSnapshot(msg Message) {
	if len(msg.Payload) < 4 {
		return
	}

	filePathLen := int(msg.Payload[0])<<8 | int(msg.Payload[1])

	if filePathLen == 0 || 2+filePathLen >= len(msg.Payload) {
		return
	}

	filePath := string(msg.Payload[2 : 2+filePathLen])
	yjsUpdate := msg.Payload[2+filePathLen:]

	// Save snapshot
	if h.snapshots == nil {
		return
	}

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

func (h *Hub) CloseRoom(roomID string, closeCode int, reason string) {
	h.mu.Lock()

	room, ok := h.rooms[roomID]
	if !ok || len(room) == 0 {
		h.mu.Unlock()
		return
	}

	clients := make([]*Client, 0, len(room))
	for client := range room {
		clients = append(clients, client)
	}

	delete(h.rooms, roomID)
	h.mu.Unlock()

	closeMessage := websocket.FormatCloseMessage(closeCode, reason)

	for _, client := range clients {
		_ = client.Conn.WriteControl(
			websocket.CloseMessage,
			closeMessage,
			time.Now().Add(writeWait),
		)

		select {
		case <-time.After(50 * time.Millisecond):
		default:
		}

		_ = client.Conn.Close()

		select {
		case <-client.Send:
		default:
		}

		safelyCloseSend(client)
		log.Printf("codedock: CloseRoom closing client room_id=%s user_id=%s", client.RoomID, client.UserID)
	}

	log.Printf("codedock: CloseRoom start room_id=%s", roomID)
	log.Printf("codedock: CloseRoom clients=%d room_id=%s", len(clients), roomID)
}

func safelyCloseSend(client *Client) {
	defer func() {
		_ = recover()
	}()
	close(client.Send)
}
