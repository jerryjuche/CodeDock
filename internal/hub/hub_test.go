package hub

import (
	"bytes"
	"testing"
	"time"
)

type mockSnapshotStore struct {
	saveCalls chan saveCall
	getCalls  chan getCall
}

type saveCall struct {
	roomID   string
	filePath string
	state    []byte
}

type getCall struct {
	roomID   string
	filePath string
}

func newMockSnapshotStore() *mockSnapshotStore {
	return &mockSnapshotStore{
		saveCalls: make(chan saveCall, 10),
		getCalls:  make(chan getCall, 10),
	}
}

func (m *mockSnapshotStore) Save(roomID, filePath string, state []byte) error {
	m.saveCalls <- saveCall{
		roomID:   roomID,
		filePath: filePath,
		state:    append([]byte(nil), state...),
	}
	return nil
}

func (m *mockSnapshotStore) Get(roomID, filePath string) ([]byte, error) {
	m.getCalls <- getCall{
		roomID:   roomID,
		filePath: filePath,
	}
	return nil, nil
}

func newHubTestClient(roomID, userID string, buffer int) *Client {
	return &Client{
		Conn:       nil,
		Send:       make(chan []byte, buffer),
		RoomID:     roomID,
		UserID:     userID,
		ClientType: "vscode",
		Bound:      true,
	}
}

func mustReceiveHubMessage(t *testing.T, ch <-chan []byte, timeout time.Duration) []byte {
	t.Helper()

	select {
	case msg := <-ch:
		return msg
	case <-time.After(timeout):
		t.Fatal("timed out waiting for hub message")
		return nil
	}
}

func mustNotReceiveHubMessage(t *testing.T, ch <-chan []byte, timeout time.Duration) {
	t.Helper()

	select {
	case msg := <-ch:
		t.Fatalf("expected no hub message, got %v", msg)
	case <-time.After(timeout):
	}
}

func buildSnapshotPayload(filePath string, yjsUpdate []byte) []byte {
	payload := []byte{
		byte(len(filePath) >> 8),
		byte(len(filePath)),
	}
	payload = append(payload, []byte(filePath)...)
	payload = append(payload, yjsUpdate...)
	return payload
}

func TestNew_InitializesHub(t *testing.T) {
	store := newMockSnapshotStore()
	h := New(store)

	if h == nil {
		t.Fatal("expected hub, got nil")
	}
	if h.rooms == nil {
		t.Fatal("expected rooms map to be initialized")
	}
	if h.counts == nil {
		t.Fatal("expected counts map to be initialized")
	}
	if h.snapshots != store {
		t.Fatal("expected snapshot store to be assigned")
	}
}

func TestRegister_AddsClientToRoom(t *testing.T) {
	h := New(nil)
	client := newHubTestClient("room-1", "user-1", 1)

	h.Register(client)

	roomClients, ok := h.rooms["room-1"]
	if !ok {
		t.Fatal("expected room to exist after register")
	}
	if !roomClients[client] {
		t.Fatal("expected client to be registered in room")
	}
}

func TestUnregister_RemovesClientAndDeletesEmptyRoom(t *testing.T) {
	h := New(nil)
	client := newHubTestClient("room-1", "user-1", 1)

	h.Register(client)
	h.Unregister(client)

	if _, ok := h.rooms["room-1"]; ok {
		t.Fatal("expected room to be removed when last client unregisters")
	}

	_, open := <-client.Send
	if open {
		t.Fatal("expected send channel to be closed")
	}
}

func TestUnregister_LeavesRoomWhenOtherClientsRemain(t *testing.T) {
	h := New(nil)

	clientA := newHubTestClient("room-1", "user-a", 1)
	clientB := newHubTestClient("room-1", "user-b", 1)

	h.Register(clientA)
	h.Register(clientB)

	h.Unregister(clientA)

	roomClients, ok := h.rooms["room-1"]
	if !ok {
		t.Fatal("expected room to still exist")
	}
	if roomClients[clientA] {
		t.Fatal("expected clientA to be removed")
	}
	if !roomClients[clientB] {
		t.Fatal("expected clientB to remain in room")
	}
}

func TestBroadcast_ExcludesOnlyTheSenderConnection(t *testing.T) {
	h := New(nil)

	sender := newHubTestClient("room-1", "same-user", 1)
	sameUserOtherConnection := newHubTestClient("room-1", "same-user", 1)
	otherUser := newHubTestClient("room-1", "other-user", 1)

	h.Register(sender)
	h.Register(sameUserOtherConnection)
	h.Register(otherUser)

	payload := []byte("hello")

	h.Broadcast(sender, "room-1", payload)

	gotSameUserOtherConn := mustReceiveHubMessage(t, sameUserOtherConnection.Send, 100*time.Millisecond)
	if !bytes.Equal(gotSameUserOtherConn, payload) {
		t.Fatalf("expected same-user second connection to receive %v, got %v", payload, gotSameUserOtherConn)
	}

	gotOtherUser := mustReceiveHubMessage(t, otherUser.Send, 100*time.Millisecond)
	if !bytes.Equal(gotOtherUser, payload) {
		t.Fatalf("expected other user to receive %v, got %v", payload, gotOtherUser)
	}

	mustNotReceiveHubMessage(t, sender.Send, 50*time.Millisecond)
}

func TestBroadcast_DropsWhenReceiverBufferIsFull(t *testing.T) {
	h := New(nil)

	sender := newHubTestClient("room-1", "sender", 1)
	slowReceiver := newHubTestClient("room-1", "receiver", 1)

	h.Register(sender)
	h.Register(slowReceiver)

	slowReceiver.Send <- []byte("already-buffered")
	h.Broadcast(sender, "room-1", []byte("new-message"))

	first := mustReceiveHubMessage(t, slowReceiver.Send, 100*time.Millisecond)
	if string(first) != "already-buffered" {
		t.Fatalf("expected first buffered message, got %q", string(first))
	}

	mustNotReceiveHubMessage(t, slowReceiver.Send, 50*time.Millisecond)
}

func TestBroadcastAll_SendsToEveryoneInRoomIncludingSender(t *testing.T) {
	h := New(nil)

	clientA := newHubTestClient("room-1", "user-a", 1)
	clientB := newHubTestClient("room-1", "user-b", 1)
	clientOtherRoom := newHubTestClient("room-2", "user-c", 1)

	h.Register(clientA)
	h.Register(clientB)
	h.Register(clientOtherRoom)

	payload := []byte("presence-update")
	h.BroadcastAll("room-1", payload)

	gotA := mustReceiveHubMessage(t, clientA.Send, 100*time.Millisecond)
	gotB := mustReceiveHubMessage(t, clientB.Send, 100*time.Millisecond)

	if !bytes.Equal(gotA, payload) {
		t.Fatalf("expected payload for clientA, got %v", gotA)
	}
	if !bytes.Equal(gotB, payload) {
		t.Fatalf("expected payload for clientB, got %v", gotB)
	}

	mustNotReceiveHubMessage(t, clientOtherRoom.Send, 50*time.Millisecond)
}

func TestRoute_SyncBroadcastsWithTypePrefixAndTracksSnapshots(t *testing.T) {
	store := newMockSnapshotStore()
	h := New(store)

	sender := newHubTestClient("room-1", "sender", 1)
	receiver := newHubTestClient("room-1", "receiver", 1)

	h.Register(sender)
	h.Register(receiver)

	payload := buildSnapshotPayload("main.go", []byte("yjs-state"))

	for i := 0; i < snapshotThreshold-1; i++ {
		h.Route(Message{
			Type:    MessageTypeSync,
			Payload: payload,
			Sender:  sender,
		})

		got := mustReceiveHubMessage(t, receiver.Send, 100*time.Millisecond)
		expected := append([]byte{MessageTypeSync}, payload...)
		if !bytes.Equal(got, expected) {
			t.Fatalf("expected %v, got %v", expected, got)
		}
	}

	select {
	case <-store.saveCalls:
		t.Fatal("expected no snapshot save before threshold")
	case <-time.After(50 * time.Millisecond):
	}

	h.Route(Message{
		Type:    MessageTypeSync,
		Payload: payload,
		Sender:  sender,
	})

	got := mustReceiveHubMessage(t, receiver.Send, 100*time.Millisecond)
	expected := append([]byte{MessageTypeSync}, payload...)
	if !bytes.Equal(got, expected) {
		t.Fatalf("expected %v after threshold hit, got %v", expected, got)
	}

	save := mustReceiveSnapshotSave(t, store.saveCalls, 200*time.Millisecond)
	if save.roomID != "room-1" {
		t.Fatalf("expected snapshot room id room-1, got %q", save.roomID)
	}
	if save.filePath != "main.go" {
		t.Fatalf("expected snapshot file path main.go, got %q", save.filePath)
	}
	if !bytes.Equal(save.state, []byte("yjs-state")) {
		t.Fatalf("expected snapshot state yjs-state, got %v", save.state)
	}
}

func TestRoute_AwarenessBroadcastsToAllIncludingSender(t *testing.T) {
	h := New(nil)

	sender := newHubTestClient("room-1", "sender", 1)
	receiver := newHubTestClient("room-1", "receiver", 1)

	h.Register(sender)
	h.Register(receiver)

	payload := []byte("awareness")
	h.Route(Message{
		Type:    MessageTypeAwareness,
		Payload: payload,
		Sender:  sender,
	})

	expected := append([]byte{MessageTypeAwareness}, payload...)

	gotSender := mustReceiveHubMessage(t, sender.Send, 100*time.Millisecond)
	gotReceiver := mustReceiveHubMessage(t, receiver.Send, 100*time.Millisecond)

	if !bytes.Equal(gotSender, expected) {
		t.Fatalf("expected sender to receive %v, got %v", expected, gotSender)
	}
	if !bytes.Equal(gotReceiver, expected) {
		t.Fatalf("expected receiver to receive %v, got %v", expected, gotReceiver)
	}
}

func TestRoute_MessageTypesThatBroadcastToOthersOnly(t *testing.T) {
	h := New(nil)

	sender := newHubTestClient("room-1", "sender", 8)
	receiver := newHubTestClient("room-1", "receiver", 8)

	h.Register(sender)
	h.Register(receiver)

	cases := []struct {
		name byte
	}{
		{name: MessageTypeChat},
		{name: MessageTypeHydrationRequest},
		{name: MessageTypeWorkspaceManifestReq},
		{name: MessageTypeWorkspaceManifestRes},
		{name: MessageTypeFileBootstrapReq},
		{name: MessageTypeFileBootstrapRes},
	}

	for _, tc := range cases {
		payload := []byte{0xAA, tc.name}

		h.Route(Message{
			Type:    tc.name,
			Payload: payload,
			Sender:  sender,
		})

		expected := append([]byte{tc.name}, payload...)
		got := mustReceiveHubMessage(t, receiver.Send, 100*time.Millisecond)

		if !bytes.Equal(got, expected) {
			t.Fatalf("expected %v for message type %d, got %v", expected, tc.name, got)
		}

		mustNotReceiveHubMessage(t, sender.Send, 50*time.Millisecond)
	}
}

func TestRoute_UnknownTypeDoesNothing(t *testing.T) {
	h := New(nil)

	sender := newHubTestClient("room-1", "sender", 1)
	receiver := newHubTestClient("room-1", "receiver", 1)

	h.Register(sender)
	h.Register(receiver)

	h.Route(Message{
		Type:    0xFF,
		Payload: []byte("unknown"),
		Sender:  sender,
	})

	mustNotReceiveHubMessage(t, sender.Send, 50*time.Millisecond)
	mustNotReceiveHubMessage(t, receiver.Send, 50*time.Millisecond)
}

func TestTrackSnapshot_DoesNothingForInvalidPayloads(t *testing.T) {
	store := newMockSnapshotStore()
	h := New(store)
	sender := newHubTestClient("room-1", "sender", 1)

	invalidPayloads := [][]byte{
		nil,
		[]byte{},
		[]byte{0x00},
		[]byte{0x00, 0x00},
		[]byte{0x00, 0x05, 'a'},
		[]byte{0x00, 0x01, 'a'},
	}

	for _, payload := range invalidPayloads {
		for i := 0; i < snapshotThreshold+2; i++ {
			h.trackSnapshot(Message{
				Type:    MessageTypeSync,
				Payload: payload,
				Sender:  sender,
			})
		}
	}

	select {
	case save := <-store.saveCalls:
		t.Fatalf("expected no snapshot save for invalid payloads, got %+v", save)
	case <-time.After(75 * time.Millisecond):
	}
}

func TestTrackSnapshot_ResetsAfterThreshold(t *testing.T) {
	store := newMockSnapshotStore()
	h := New(store)
	sender := newHubTestClient("room-1", "sender", 1)

	payload := buildSnapshotPayload("index.html", []byte("state"))

	for i := 0; i < snapshotThreshold; i++ {
		h.trackSnapshot(Message{
			Type:    MessageTypeSync,
			Payload: payload,
			Sender:  sender,
		})
	}

	firstSave := mustReceiveSnapshotSave(t, store.saveCalls, 200*time.Millisecond)
	if firstSave.filePath != "index.html" {
		t.Fatalf("expected first snapshot for index.html, got %q", firstSave.filePath)
	}

	for i := 0; i < snapshotThreshold-1; i++ {
		h.trackSnapshot(Message{
			Type:    MessageTypeSync,
			Payload: payload,
			Sender:  sender,
		})
	}

	select {
	case save := <-store.saveCalls:
		t.Fatalf("expected no second save before second threshold, got %+v", save)
	case <-time.After(75 * time.Millisecond):
	}

	h.trackSnapshot(Message{
		Type:    MessageTypeSync,
		Payload: payload,
		Sender:  sender,
	})

	secondSave := mustReceiveSnapshotSave(t, store.saveCalls, 200*time.Millisecond)
	if secondSave.filePath != "index.html" {
		t.Fatalf("expected second snapshot for index.html, got %q", secondSave.filePath)
	}
}

func mustReceiveSnapshotSave(t *testing.T, ch <-chan saveCall, timeout time.Duration) saveCall {
	t.Helper()

	select {
	case call := <-ch:
		return call
	case <-time.After(timeout):
		t.Fatal("timed out waiting for snapshot save")
		return saveCall{}
	}
}

func TestConnectedUserIDs_OnlyReturnsBoundClients(t *testing.T) {
	h := New(nil)

	clientA := newHubTestClient("room-1", "user-a", 1)
	clientB := newHubTestClient("room-1", "user-b", 1)
	clientA.Bound = false
	clientB.Bound = false

	h.Register(clientA)
	h.Register(clientB)

	// Initially, neither is bound.
	connected := h.ConnectedUserIDs("room-1")
	if len(connected) != 0 {
		t.Fatalf("expected no connected users, got %v", connected)
	}

	// Set clientA as bound.
	h.SetClientBound("room-1", "user-a")

	connected = h.ConnectedUserIDs("room-1")
	if len(connected) != 1 || !connected["user-a"] {
		t.Fatalf("expected user-a to be connected, got %v", connected)
	}
}

func TestRoute_MarksBoundAndBroadcasts(t *testing.T) {
	h := New(nil)

	sender := newHubTestClient("room-1", "sender", 2)
	receiver := newHubTestClient("room-1", "receiver", 2)
	sender.Bound = false
	receiver.Bound = false

	h.Register(sender)
	h.Register(receiver)

	// Since we are routing a message, sender should be marked bound and receiver should receive MessageTypeRoomUpdate.
	h.Route(Message{
		Type:    MessageTypeChat,
		Payload: []byte("hello"),
		Sender:  sender,
	})

	h.mu.RLock()
	isBound := sender.Bound
	h.mu.RUnlock()

	if !isBound {
		t.Fatal("expected sender to be marked bound after routing message")
	}

	// The receiver should have received the MessageTypeRoomUpdate (0x0A) broadcasted to everyone, and also the chat message (for other clients).
	// Because BroadcastAll is called for MessageTypeRoomUpdate, both receiver and sender get it.
	updateMsg := mustReceiveHubMessage(t, receiver.Send, 100*time.Millisecond)
	if len(updateMsg) != 1 || updateMsg[0] != MessageTypeRoomUpdate {
		t.Fatalf("expected room update message, got %v", updateMsg)
	}
}