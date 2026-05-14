package hub

// Message type constants.
// The first byte of every WebSocket message identifies its type.
const (
	MessageTypeSync                 byte = 0x01 // CRDT document update from Yjs
	MessageTypeAwareness            byte = 0x02 // cursor position and presence
	MessageTypeChat                 byte = 0x03 // chat message
	MessageTypeHydrationRequest     byte = 0x04 // guest asks host for current file state
	MessageTypeWorkspaceManifestReq byte = 0x05 // guest asks host for workspace tree
	MessageTypeWorkspaceManifestRes byte = 0x06 // host returns workspace tree
	MessageTypeFileBootstrapReq     byte = 0x07 // guest asks host for file contents
	MessageTypeFileBootstrapRes     byte = 0x08 // host returns file contents
	MessageTypeFileActivity         byte = 0x09 // file text snippet for activity feed
	MessageTypeRoomUpdate           byte = 0x0A // signal to clients to re-fetch room metadata
)

// Message carries a decoded incoming message ready for routing.
type Message struct {
	Type    byte
	Payload []byte
	Sender  *Client
}