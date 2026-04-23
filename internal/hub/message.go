package hub

// Message type constants.
// The first byte of every WebSocket message identifies its type.
const (
	MessageTypeSync             byte = 0x01 // CRDT document update from Yjs
	MessageTypeAwareness        byte = 0x02 // cursor position and presence
	MessageTypeChat             byte = 0x03 // chat message
	MessageTypeHydrationRequest byte = 0x04 // guest asks host for current file state
)

// Message carries a decoded incoming message ready for routing.
type Message struct {
	Type    byte
	Payload []byte
	Sender  *Client
}