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

func newTestClient(roomID, userID string, buffer int) *Client {
	return &Client{
		Conn:   nil,
		Send:   make(chan []byte, buffer),
		RoomID: roomID,
		UserID: userID,
	}
}

func mustReceiveMessage(t *testing.T, ch <-chan []byte, timeout time.Duration) []byte {
	t.Helper()

	select {
	case msg := <-ch:
		return msg
	case <-time.After(timeout):
		t.Fatal("timed out waiting for message")
		return nil
	}
}

func mustNotReceiveMessage(t *testing.T, ch <-chan []byte, timeout time.Duration) {
	t.Helper()

	select {
	case msg := <-ch:
		t.Fatalf("expected no message, but received %v", msg)
	case <-time.After(timeout):
	}
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
	client := newTestClient("room-1", "user-1", 1)

	h.Register(client)

	roomClients, ok := h.rooms["room-1"]
	if !ok {
		t.Fatal("expected room to exist after register")
	}

	if !roomClients[client] {
		t.Fatal("expected client to be registered in room")
	}
}

func TestRegister_CreatesSeparateRooms(t *testing.T) {
	h := New(nil)

	clientA := newTestClient("room-a", "user-a", 1)
	clientB := newTestClient("room-b", "user-b", 1)

	h.Register(clientA)
	h.Register(clientB)

	if len(h.rooms) != 2 {
		t.Fatalf("expected 2 rooms, got %d", len(h.rooms))
	}

	if !h.rooms["room-a"][clientA] {
		t.Fatal("expected clientA in room-a")
	}

	if !h.rooms["room-b"][clientB] {
		t.Fatal("expected clientB in room-b")
	}
}

func TestUnregister_RemovesClientAndClosesSendChannel(t *testing.T) {
	h := New(nil)
	client := newTestClient("room-1", "user-1", 1)

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

	clientA := newTestClient("room-1", "user-a", 1)
	clientB := newTestClient("room-1", "user-b", 1)

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

	_, open := <-clientA.Send
	if open {
		t.Fatal("expected clientA send channel to be closed")
	}
}

func TestUnregister_NonExistentRoomDoesNothing(t *testing.T) {
	h := New(nil)
	client := newTestClient("missing-room", "user-1", 1)

	h.Unregister(client)
}

func TestBroadcast_SendsToOtherClientsInSameRoomOnly(t *testing.T) {
	h := New(nil)

	sender := newTestClient("room-1", "sender", 1)
	receiver := newTestClient("room-1", "receiver", 1)
	otherRoom := newTestClient("room-2", "other", 1)

	h.Register(sender)
	h.Register(receiver)
	h.Register(otherRoom)

	payload := []byte("hello room")
	h.Broadcast("sender", "room-1", payload)

	got := mustReceiveMessage(t, receiver.Send, 100*time.Millisecond)
	if !bytes.Equal(got, payload) {
		t.Fatalf("expected %v, got %v", payload, got)
	}

	mustNotReceiveMessage(t, sender.Send, 50*time.Millisecond)
	mustNotReceiveMessage(t, otherRoom.Send, 50*time.Millisecond)
}

func TestBroadcast_DropsMessageWhenReceiverBufferIsFull(t *testing.T) {
	h := New(nil)

	sender := newTestClient("room-1", "sender", 1)
	slowReceiver := newTestClient("room-1", "receiver", 1)

	h.Register(sender)
	h.Register(slowReceiver)

	// Fill receiver buffer so broadcast default case is hit.
	slowReceiver.Send <- []byte("already buffered")

	h.Broadcast("sender", "room-1", []byte("new message"))

	first := mustReceiveMessage(t, slowReceiver.Send, 100*time.Millisecond)
	if string(first) != "already buffered" {
		t.Fatalf("expected original buffered message, got %q", string(first))
	}

	mustNotReceiveMessage(t, slowReceiver.Send, 50*time.Millisecond)
}

func TestBroadcastAll_SendsToEveryoneInRoomIncludingSender(t *testing.T) {
	h := New(nil)

	clientA := newTestClient("room-1", "user-a", 1)
	clientB := newTestClient("room-1", "user-b", 1)
	clientC := newTestClient("room-2", "user-c", 1)

	h.Register(clientA)
	h.Register(clientB)
	h.Register(clientC)

	payload := []byte("presence update")
	h.BroadcastAll("room-1", payload)

	gotA := mustReceiveMessage(t, clientA.Send, 100*time.Millisecond)
	gotB := mustReceiveMessage(t, clientB.Send, 100*time.Millisecond)

	if !bytes.Equal(gotA, payload) {
		t.Fatalf("expected %v for clientA, got %v", payload, gotA)
	}

	if !bytes.Equal(gotB, payload) {
		t.Fatalf("expected %v for clientB, got %v", payload, gotB)
	}

	mustNotReceiveMessage(t, clientC.Send, 50*time.Millisecond)
}

func TestRoute_SyncBroadcastsToOthersWithTypePrefix(t *testing.T) {
	h := New(nil)

	sender := newTestClient("room-1", "sender", 1)
	receiver := newTestClient("room-1", "receiver", 1)

	h.Register(sender)
	h.Register(receiver)

	payload := []byte("sync-payload")
	h.Route(Message{
		Type:    MessageTypeSync,
		Payload: payload,
		Sender:  sender,
	})

	got := mustReceiveMessage(t, receiver.Send, 100*time.Millisecond)
	expected := append([]byte{MessageTypeSync}, payload...)

	if !bytes.Equal(got, expected) {
		t.Fatalf("expected %v, got %v", expected, got)
	}

	mustNotReceiveMessage(t, sender.Send, 50*time.Millisecond)
}

func TestRoute_AwarenessBroadcastsToAllIncludingSender(t *testing.T) {
	h := New(nil)

	sender := newTestClient("room-1", "sender", 1)
	receiver := newTestClient("room-1", "receiver", 1)

	h.Register(sender)
	h.Register(receiver)

	payload := []byte("awareness")
	h.Route(Message{
		Type:    MessageTypeAwareness,
		Payload: payload,
		Sender:  sender,
	})

	expected := append([]byte{MessageTypeAwareness}, payload...)

	gotSender := mustReceiveMessage(t, sender.Send, 100*time.Millisecond)
	gotReceiver := mustReceiveMessage(t, receiver.Send, 100*time.Millisecond)

	if !bytes.Equal(gotSender, expected) {
		t.Fatalf("expected sender to receive %v, got %v", expected, gotSender)
	}

	if !bytes.Equal(gotReceiver, expected) {
		t.Fatalf("expected receiver to receive %v, got %v", expected, gotReceiver)
	}
}

func TestRoute_ChatBroadcastsToOthersOnly(t *testing.T) {
	h := New(nil)

	sender := newTestClient("room-1", "sender", 1)
	receiver := newTestClient("room-1", "receiver", 1)

	h.Register(sender)
	h.Register(receiver)

	payload := []byte("chat message")
	h.Route(Message{
		Type:    MessageTypeChat,
		Payload: payload,
		Sender:  sender,
	})

	expected := append([]byte{MessageTypeChat}, payload...)

	got := mustReceiveMessage(t, receiver.Send, 100*time.Millisecond)
	if !bytes.Equal(got, expected) {
		t.Fatalf("expected %v, got %v", expected, got)
	}

	mustNotReceiveMessage(t, sender.Send, 50*time.Millisecond)
}

func TestRoute_UnknownTypeDoesNothing(t *testing.T) {
	h := New(nil)

	sender := newTestClient("room-1", "sender", 1)
	receiver := newTestClient("room-1", "receiver", 1)

	h.Register(sender)
	h.Register(receiver)

	h.Route(Message{
		Type:    0xFF,
		Payload: []byte("unknown"),
		Sender:  sender,
	})

	mustNotReceiveMessage(t, sender.Send, 50*time.Millisecond)
	mustNotReceiveMessage(t, receiver.Send, 50*time.Millisecond)
}

func TestTrackAndSnapshot_DoesNothingWithoutStore(t *testing.T) {
	h := New(nil)
	sender := newTestClient("room-1", "sender", 1)

	for i := 0; i < snapshotThreshold+5; i++ {
		h.trackAndSnapshot(Message{
			Type:    MessageTypeSync,
			Payload: []byte("state"),
			Sender:  sender,
		})
	}
}

func TestTrackAndSnapshot_SavesAtThreshold(t *testing.T) {
	store := newMockSnapshotStore()
	h := New(store)
	sender := newTestClient("room-1", "sender", 1)

	payload := []byte("snapshot-state")

	for i := 0; i < snapshotThreshold-1; i++ {
		h.trackAndSnapshot(Message{
			Type:    MessageTypeSync,
			Payload: payload,
			Sender:  sender,
		})
	}

	select {
	case call := <-store.saveCalls:
		t.Fatalf("did not expect snapshot save before threshold, got %+v", call)
	default:
	}

	h.trackAndSnapshot(Message{
		Type:    MessageTypeSync,
		Payload: payload,
		Sender:  sender,
	})

	select {
	case call := <-store.saveCalls:
		if call.roomID != "room-1" {
			t.Fatalf("expected roomID room-1, got %s", call.roomID)
		}
		if call.filePath != "default" {
			t.Fatalf("expected filePath default, got %s", call.filePath)
		}
		if !bytes.Equal(call.state, payload) {
			t.Fatalf("expected state %v, got %v", payload, call.state)
		}
	case <-time.After(250 * time.Millisecond):
		t.Fatal("expected snapshot save at threshold")
	}
}

func TestTrackAndSnapshot_ResetsCounterAfterThreshold(t *testing.T) {
	store := newMockSnapshotStore()
	h := New(store)
	sender := newTestClient("room-1", "sender", 1)

	payload := []byte("state")

	for i := 0; i < snapshotThreshold; i++ {
		h.trackAndSnapshot(Message{
			Type:    MessageTypeSync,
			Payload: payload,
			Sender:  sender,
		})
	}

	select {
	case <-store.saveCalls:
	case <-time.After(250 * time.Millisecond):
		t.Fatal("expected first snapshot save")
	}

	// After reset, one more call should not immediately save again.
	h.trackAndSnapshot(Message{
		Type:    MessageTypeSync,
		Payload: payload,
		Sender:  sender,
	})

	select {
	case call := <-store.saveCalls:
		t.Fatalf("did not expect second save immediately after reset, got %+v", call)
	case <-time.After(100 * time.Millisecond):
	}
}
