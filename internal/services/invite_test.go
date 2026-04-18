package services

import (
	"sync"
	"testing"
	"time"
)

func createTestInvite(t *testing.T, db interface{ Exec(string, ...any) (interface{}, error) }, roomID, createdBy, code string, expiresAt time.Time, usedAt *time.Time) {
	t.Helper()
	_, err := db.Exec(`
		INSERT INTO invite_tokens (token, room_id, created_by, expires_at, used_at)
		VALUES ($1, $2, $3, $4, $5)
	`, code, roomID, createdBy, expiresAt, usedAt)
	if err != nil {
		t.Fatalf("failed to insert test invite: %v", err)
	}
}


func TestExchangeInviteCode_Success(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	cleanTestDB(t, db)

	userID := createTestUser(t, db, "invite-success@codedock.com")
	service := &RoomService{DB: db}
	room, err := service.CreateRoom(userID, "invite-test-room")
	if err != nil {
		t.Fatalf("failed to create room: %v", err)
	}

	code := "valid-code-001"
	_, err = db.Exec(`
		INSERT INTO invite_tokens (token, room_id, created_by, expires_at, used_at)
		VALUES ($1, $2, $3, $4, NULL)
	`, code, room.ID, userID, time.Now().Add(1*time.Hour))
	if err != nil {
		t.Fatalf("failed to insert invite: %v", err)
	}

	result, err := ExchangeInviteCode(db, code)
	if err != nil {
		t.Fatalf("expected success, got error: %v", err)
	}
	if result.RoomID != room.ID {
		t.Errorf("expected roomID %s, got %s", room.ID, result.RoomID)
	}
}

func TestExchangeInviteCode_InvalidCode(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	cleanTestDB(t, db)

	_, err := ExchangeInviteCode(db, "code-that-does-not-exist")
	if err != ErrInviteNotFound {
		t.Errorf("expected ErrInviteNotFound, got %v", err)
	}
}

func TestExchangeInviteCode_ExpiredCode(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	cleanTestDB(t, db)

	userID := createTestUser(t, db, "invite-expired@codedock.com")
	service := &RoomService{DB: db}
	room, err := service.CreateRoom(userID, "invite-expired-room")
	if err != nil {
		t.Fatalf("failed to create room: %v", err)
	}

	code := "expired-code-001"
	_, err = db.Exec(`
		INSERT INTO invite_tokens (token, room_id, created_by, expires_at, used_at)
		VALUES ($1, $2, $3, $4, NULL)
	`, code, room.ID, userID, time.Now().Add(-1*time.Hour))
	if err != nil {
		t.Fatalf("failed to insert expired invite: %v", err)
	}

	_, err = ExchangeInviteCode(db, code)
	if err != ErrInviteExpired {
		t.Errorf("expected ErrInviteExpired, got %v", err)
	}
}

func TestExchangeInviteCode_AlreadyUsedCode(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	cleanTestDB(t, db)

	userID := createTestUser(t, db, "invite-used@codedock.com")
	service := &RoomService{DB: db}
	room, err := service.CreateRoom(userID, "invite-used-room")
	if err != nil {
		t.Fatalf("failed to create room: %v", err)
	}

	code := "used-code-001"
	usedAt := time.Now().Add(-10 * time.Minute)
	_, err = db.Exec(`
		INSERT INTO invite_tokens (token, room_id, created_by, expires_at, used_at)
		VALUES ($1, $2, $3, $4, $5)
	`, code, room.ID, userID, time.Now().Add(1*time.Hour), usedAt)
	if err != nil {
		t.Fatalf("failed to insert used invite: %v", err)
	}

	_, err = ExchangeInviteCode(db, code)
	if err != ErrInviteExpired {
		t.Errorf("expected ErrInviteExpired for used code, got %v", err)
	}
}

func TestExchangeInviteCode_ConcurrentExchange(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	cleanTestDB(t, db)

	userID := createTestUser(t, db, "invite-concurrent@codedock.com")
	service := &RoomService{DB: db}
	room, err := service.CreateRoom(userID, "invite-concurrent-room")
	if err != nil {
		t.Fatalf("failed to create room: %v", err)
	}

	code := "concurrent-code-001"
	_, err = db.Exec(`
		INSERT INTO invite_tokens (token, room_id, created_by, expires_at, used_at)
		VALUES ($1, $2, $3, $4, NULL)
	`, code, room.ID, userID, time.Now().Add(1*time.Hour))
	if err != nil {
		t.Fatalf("failed to insert concurrent invite: %v", err)
	}

	var wg sync.WaitGroup
	results := make([]error, 2)

	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func(index int) {
			defer wg.Done()
			_, err := ExchangeInviteCode(db, code)
			results[index] = err
		}(i)
	}

	wg.Wait()

	successCount := 0
	failCount := 0
	for _, err := range results {
		if err == nil {
			successCount++
		} else {
			failCount++
		}
	}

	if successCount != 1 {
		t.Errorf("expected exactly 1 success, got %d", successCount)
	}
	if failCount != 1 {
		t.Errorf("expected exactly 1 failure, got %d", failCount)
	}
}