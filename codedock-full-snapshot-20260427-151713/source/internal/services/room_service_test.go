package services

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"testing"

	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

var loadEnvOnce sync.Once

func loadTestEnv(t *testing.T) {
	t.Helper()

	loadEnvOnce.Do(func() {
		candidates := []string{
			".env",
			filepath.Join("..", "..", ".env"),
			filepath.Join("..", "..", "..", ".env"),
		}

		for _, candidate := range candidates {
			if _, err := os.Stat(candidate); err == nil {
				if err := godotenv.Overload(candidate); err != nil {
					t.Fatalf("found .env at %s but failed to load it: %v", candidate, err)
				}
				t.Logf("loaded environment from %s", candidate)
				return
			}
		}

		t.Log("no .env file found in known locations, using system environment")
	})
}

func requireEnv(t *testing.T, key string) string {
	t.Helper()

	value := os.Getenv(key)
	if value == "" {
		t.Fatalf("required environment variable %s is empty", key)
	}

	return value
}

func setupTestDB(t *testing.T) *sql.DB {
	t.Helper()

	loadTestEnv(t)

	connStr := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		requireEnv(t, "DB_HOST"),
		requireEnv(t, "DB_PORT"),
		requireEnv(t, "DB_USER"),
		requireEnv(t, "DB_PASSWORD"),
		requireEnv(t, "TEST_DB_NAME"),
	)

	db, err := sql.Open("postgres", connStr)
	if err != nil {
		t.Fatalf("could not open test database: %v", err)
	}

	if err := db.Ping(); err != nil {
		t.Fatalf("could not connect to test database: %v", err)
	}

	return db
}

func cleanTestDB(t *testing.T, db *sql.DB) {
	t.Helper()

	tables := []string{
		"invite_tokens",
		"room_members",
		"snapshots",
		"rooms",
		"users",
	}

	for _, table := range tables {
		if _, err := db.Exec("DELETE FROM " + table); err != nil {
			t.Fatalf("failed to clean table %s: %v", table, err)
		}
	}
}

func createTestUser(t *testing.T, db *sql.DB, email string) string {
	t.Helper()

	var userID string
	err := db.QueryRow(`
		INSERT INTO users (email, password_hash)
		VALUES ($1, $2)
		RETURNING id
	`, email, "hashed-password").Scan(&userID)
	if err != nil {
		t.Fatalf("failed to create test user: %v", err)
	}

	return userID
}

func TestRoomService_CreateRoom_Success(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	cleanTestDB(t, db)

	service := &RoomService{DB: db}
	userID := createTestUser(t, db, "service-create@codedock.com")

	room, err := service.CreateRoom(userID, "Service Test Room")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if room == nil {
		t.Fatal("expected room, got nil")
	}

	if room.ID == "" {
		t.Fatal("expected created room to have an ID")
	}

	if room.Name != "Service Test Room" {
		t.Fatalf("expected room name Service Test Room, got %q", room.Name)
	}

	if room.CreatedBy != userID {
		t.Fatalf("expected created_by %s, got %s", userID, room.CreatedBy)
	}

	if !room.IsActive {
		t.Fatal("expected created room to be active")
	}

	// Verify host membership was also created.
	var count int
	err = db.QueryRow(`
		SELECT COUNT(*)
		FROM room_members
		WHERE user_id = $1 AND room_id = $2 AND role = 'host'
	`, userID, room.ID).Scan(&count)
	if err != nil {
		t.Fatalf("failed verifying room membership: %v", err)
	}

	if count != 1 {
		t.Fatalf("expected 1 host membership row, got %d", count)
	}
}

func TestRoomService_CreateRoom_EmptyName(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	cleanTestDB(t, db)

	service := &RoomService{DB: db}
	userID := createTestUser(t, db, "service-empty@codedock.com")

	room, err := service.CreateRoom(userID, "")
	if err == nil {
		t.Fatal("expected error for empty room name, got nil")
	}

	if room != nil {
		t.Fatal("expected nil room when create fails")
	}

	if err.Error() != "Room name is required" {
		t.Fatalf("expected 'Room name is required', got %q", err.Error())
	}
}

func TestRoomService_GetRoom_Success(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	cleanTestDB(t, db)

	service := &RoomService{DB: db}
	userID := createTestUser(t, db, "service-get@codedock.com")

	created, err := service.CreateRoom(userID, "Lookup Room")
	if err != nil {
		t.Fatalf("failed to create room: %v", err)
	}

	room, err := service.GetRoom(created.ID)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if room == nil {
		t.Fatal("expected room, got nil")
	}

	if room.ID != created.ID {
		t.Fatalf("expected room ID %s, got %s", created.ID, room.ID)
	}

	if room.Name != "Lookup Room" {
		t.Fatalf("expected room name Lookup Room, got %q", room.Name)
	}
}

func TestRoomService_GetRoom_NotFound(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	cleanTestDB(t, db)

	service := &RoomService{DB: db}

	room, err := service.GetRoom("00000000-0000-0000-0000-000000000000")
	if err == nil {
		t.Fatal("expected error for missing room, got nil")
	}

	if room != nil {
		t.Fatal("expected nil room for missing room")
	}

	if err.Error() != "no room found" {
		t.Fatalf("expected 'no room found', got %q", err.Error())
	}
}

func TestRoomService_GetUserRooms_ReturnsCreatedRooms(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	cleanTestDB(t, db)

	service := &RoomService{DB: db}
	userID := createTestUser(t, db, "service-list@codedock.com")

	first, err := service.CreateRoom(userID, "Room A")
	if err != nil {
		t.Fatalf("failed creating Room A: %v", err)
	}

	second, err := service.CreateRoom(userID, "Room B")
	if err != nil {
		t.Fatalf("failed creating Room B: %v", err)
	}

	rooms, err := service.GetUserRooms(userID)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if len(rooms) != 2 {
		t.Fatalf("expected 2 rooms, got %d", len(rooms))
	}

	found := map[string]bool{
		first.ID:  false,
		second.ID: false,
	}

	for _, room := range rooms {
		if _, ok := found[room.ID]; ok {
			found[room.ID] = true
		}
	}

	if !found[first.ID] {
		t.Fatalf("expected room %s to be in user room list", first.ID)
	}

	if !found[second.ID] {
		t.Fatalf("expected room %s to be in user room list", second.ID)
	}
}

func TestRoomService_GetUserRooms_Empty(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	cleanTestDB(t, db)

	service := &RoomService{DB: db}
	userID := createTestUser(t, db, "service-empty-list@codedock.com")

	rooms, err := service.GetUserRooms(userID)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if rooms == nil {
		t.Fatal("expected empty slice, got nil")
	}

	if len(rooms) != 0 {
		t.Fatalf("expected 0 rooms, got %d", len(rooms))
	}
}
