package services

import (
	"database/sql"
	"testing"
)

func createTestRoom(t *testing.T, db *sql.DB, userID, name string) string {
	t.Helper()

	var roomID string
	err := db.QueryRow(`
		INSERT INTO rooms (name, created_by)
		VALUES ($1, $2)
		RETURNING id
	`, name, userID).Scan(&roomID)
	if err != nil {
		t.Fatalf("failed to create test room: %v", err)
	}

	_, err = db.Exec(`
		INSERT INTO room_members (user_id, room_id, role)
		VALUES ($1, $2, 'host')
	`, userID, roomID)
	if err != nil {
		t.Fatalf("failed to create room membership: %v", err)
	}

	return roomID
}

func TestSaveSnapshot_ThenGetSnapshot(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	cleanTestDB(t, db)

	userID := createTestUser(t, db, "snapshot-readwrite@codedock.com")
	roomID := createTestRoom(t, db, userID, "Snapshot Room")

	filePath := "frontend/src/App.jsx"
	original := []byte("initial yjs state")

	if err := SaveSnapshot(db, roomID, filePath, original); err != nil {
		t.Fatalf("expected no error saving snapshot, got %v", err)
	}

	got, err := GetSnapshot(db, roomID, filePath)
	if err != nil {
		t.Fatalf("expected no error getting snapshot, got %v", err)
	}

	if got == nil {
		t.Fatal("expected snapshot bytes, got nil")
	}

	if string(got) != string(original) {
		t.Fatalf("expected %q, got %q", string(original), string(got))
	}
}

func TestSaveSnapshot_UpsertUpdatesExistingState(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	cleanTestDB(t, db)

	userID := createTestUser(t, db, "snapshot-upsert@codedock.com")
	roomID := createTestRoom(t, db, userID, "Upsert Room")

	filePath := "backend/main.go"
	firstState := []byte("first state")
	secondState := []byte("updated state")

	if err := SaveSnapshot(db, roomID, filePath, firstState); err != nil {
		t.Fatalf("failed saving first snapshot: %v", err)
	}

	if err := SaveSnapshot(db, roomID, filePath, secondState); err != nil {
		t.Fatalf("failed saving updated snapshot: %v", err)
	}

	got, err := GetSnapshot(db, roomID, filePath)
	if err != nil {
		t.Fatalf("expected no error getting updated snapshot, got %v", err)
	}

	if got == nil {
		t.Fatal("expected updated snapshot bytes, got nil")
	}

	if string(got) != string(secondState) {
		t.Fatalf("expected updated state %q, got %q", string(secondState), string(got))
	}
}

func TestGetSnapshot_NotFoundReturnsNilNil(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	cleanTestDB(t, db)

	userID := createTestUser(t, db, "snapshot-missing@codedock.com")
	roomID := createTestRoom(t, db, userID, "Missing Snapshot Room")

	got, err := GetSnapshot(db, roomID, "missing/file.go")
	if err != nil {
		t.Fatalf("expected nil error for missing snapshot, got %v", err)
	}

	if got != nil {
		t.Fatalf("expected nil snapshot for missing row, got %q", string(got))
	}
}

func TestDBSnapshotStore_SaveAndGet(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	cleanTestDB(t, db)

	store := &DBSnapshotStore{DB: db}
	userID := createTestUser(t, db, "snapshot-store@codedock.com")
	roomID := createTestRoom(t, db, userID, "Store Room")

	filePath := "internal/services/snapshot.go"
	state := []byte("store state")

	if err := store.Save(roomID, filePath, state); err != nil {
		t.Fatalf("expected no error from store.Save, got %v", err)
	}

	got, err := store.Get(roomID, filePath)
	if err != nil {
		t.Fatalf("expected no error from store.Get, got %v", err)
	}

	if got == nil {
		t.Fatal("expected snapshot bytes, got nil")
	}

	if string(got) != string(state) {
		t.Fatalf("expected %q, got %q", string(state), string(got))
	}
}
