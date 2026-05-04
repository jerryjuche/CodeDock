package services

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

func TestInviteService_ResolvePrimaryJoinCode_AddsMembershipAndIsIdempotent(t *testing.T) {
	db := openInviteServiceTestDB(t)
	defer db.Close()

	prepareInviteServiceTestDB(t, db)

	hostID := mustCreateInviteServiceUser(t, db, "invite-host-primary")
	guestID := mustCreateInviteServiceUser(t, db, "invite-guest-primary")

	room := mustCreateInviteServiceRoom(t, db, hostID, "Primary Join Room")

	service := &InviteService{DB: db}

	result, err := service.ResolveJoinCodeForUser(room.PrimaryJoinCode, guestID)
	if err != nil {
		t.Fatalf("expected no error resolving primary code, got %v", err)
	}

	if result.Room == nil {
		t.Fatal("expected room in join-code resolution result")
	}
	if result.Room.ID != room.ID {
		t.Fatalf("expected room id %q, got %q", room.ID, result.Room.ID)
	}
	if result.Role != "editor" {
		t.Fatalf("expected editor role, got %q", result.Role)
	}
	if !result.Joined {
		t.Fatal("expected first primary-code join to report joined=true")
	}

	rejoinResult, err := service.ResolveJoinCodeForUser(room.PrimaryJoinCode, guestID)
	if err != nil {
		t.Fatalf("expected no error resolving primary code second time, got %v", err)
	}
	if rejoinResult.Joined {
		t.Fatal("expected second primary-code resolution to report joined=false")
	}
	if rejoinResult.Role != "editor" {
		t.Fatalf("expected editor role on second resolve, got %q", rejoinResult.Role)
	}

	hostResult, err := service.ResolveJoinCodeForUser(room.PrimaryJoinCode, hostID)
	if err != nil {
		t.Fatalf("expected no error resolving primary code for host, got %v", err)
	}
	if hostResult.Role != "host" {
		t.Fatalf("expected host role for room owner, got %q", hostResult.Role)
	}
	if hostResult.Joined {
		t.Fatal("expected host primary-code resolution to report joined=false")
	}
}

func TestInviteService_CreateListRevokeAndResolveInviteTokens(t *testing.T) {
	db := openInviteServiceTestDB(t)
	defer db.Close()

	prepareInviteServiceTestDB(t, db)

	hostID := mustCreateInviteServiceUser(t, db, "invite-host-token")
	guestAID := mustCreateInviteServiceUser(t, db, "invite-guest-a")
	guestBID := mustCreateInviteServiceUser(t, db, "invite-guest-b")
	guestCID := mustCreateInviteServiceUser(t, db, "invite-guest-c")

	room := mustCreateInviteServiceRoom(t, db, hostID, "Token Join Room")

	service := &InviteService{DB: db}

	expiresInHours := 24
	maxUses := 1

	invite, err := service.CreateRoomInviteToken(room.ID, hostID, &expiresInHours, &maxUses)
	if err != nil {
		t.Fatalf("expected no error creating invite token, got %v", err)
	}

	if invite.ID == "" {
		t.Fatal("expected invite id to be non-empty")
	}
	if len(invite.Code) != 6 {
		t.Fatalf("expected 6-char invite code, got %q", invite.Code)
	}
	if invite.MaxUses == nil || *invite.MaxUses != 1 {
		t.Fatalf("expected invite max_uses=1, got %#v", invite.MaxUses)
	}
	if invite.ExpiresAt == nil {
		t.Fatal("expected invite expiration to be set")
	}

	listed, err := service.ListRoomInviteTokens(room.ID, hostID)
	if err != nil {
		t.Fatalf("expected no error listing room invites, got %v", err)
	}
	if len(listed) != 1 {
		t.Fatalf("expected 1 invite, got %d", len(listed))
	}
	if listed[0].Code != invite.Code {
		t.Fatalf("expected invite code %q, got %q", invite.Code, listed[0].Code)
	}

	firstJoin, err := service.ResolveJoinCodeForUser(invite.Code, guestAID)
	if err != nil {
		t.Fatalf("expected no error resolving invite code first time, got %v", err)
	}
	if !firstJoin.Joined {
		t.Fatal("expected joined=true on first invite use")
	}
	if firstJoin.Role != "editor" {
		t.Fatalf("expected editor role on invite join, got %q", firstJoin.Role)
	}

	listedAfterUse, err := service.ListRoomInviteTokens(room.ID, hostID)
	if err != nil {
		t.Fatalf("expected no error listing room invites after use, got %v", err)
	}
	if len(listedAfterUse) != 1 {
		t.Fatalf("expected 1 invite after use, got %d", len(listedAfterUse))
	}
	if listedAfterUse[0].UsesCount != 1 {
		t.Fatalf("expected uses_count=1 after one use, got %d", listedAfterUse[0].UsesCount)
	}

	_, err = service.ResolveJoinCodeForUser(invite.Code, guestBID)
	if !errors.Is(err, ErrJoinCodeExpired) {
		t.Fatalf("expected ErrJoinCodeExpired after max uses reached, got %v", err)
	}

	revokableInvite, err := service.CreateRoomInviteToken(room.ID, hostID, nil, nil)
	if err != nil {
		t.Fatalf("expected no error creating revokable invite, got %v", err)
	}

	if err := service.RevokeRoomInviteToken(room.ID, revokableInvite.ID, hostID); err != nil {
		t.Fatalf("expected no error revoking invite, got %v", err)
	}

	_, err = service.ResolveJoinCodeForUser(revokableInvite.Code, guestCID)
	if !errors.Is(err, ErrJoinCodeExpired) {
		t.Fatalf("expected ErrJoinCodeExpired for revoked invite, got %v", err)
	}
}

func TestInviteService_CreateAndListInvites_RequiresHost(t *testing.T) {
	db := openInviteServiceTestDB(t)
	defer db.Close()

	prepareInviteServiceTestDB(t, db)

	hostID := mustCreateInviteServiceUser(t, db, "invite-host-access")
	guestID := mustCreateInviteServiceUser(t, db, "invite-guest-access")

	room := mustCreateInviteServiceRoom(t, db, hostID, "Invite Access Room")

	service := &InviteService{DB: db}

	_, err := service.CreateRoomInviteToken(room.ID, guestID, nil, nil)
	if !errors.Is(err, ErrRoomForbidden) {
		t.Fatalf("expected ErrRoomForbidden when guest creates invite, got %v", err)
	}

	_, err = service.ListRoomInviteTokens(room.ID, guestID)
	if !errors.Is(err, ErrRoomForbidden) {
		t.Fatalf("expected ErrRoomForbidden when guest lists invites, got %v", err)
	}

	err = service.RevokeRoomInviteToken(room.ID, "non-existent", guestID)
	if !errors.Is(err, ErrRoomForbidden) {
		t.Fatalf("expected ErrRoomForbidden when guest revokes invite, got %v", err)
	}
}

func TestInviteService_CreateInvite_ValidatesConfig(t *testing.T) {
	db := openInviteServiceTestDB(t)
	defer db.Close()

	prepareInviteServiceTestDB(t, db)

	hostID := mustCreateInviteServiceUser(t, db, "invite-host-config")
	room := mustCreateInviteServiceRoom(t, db, hostID, "Invite Config Room")

	service := &InviteService{DB: db}

	zeroHours := 0
	_, err := service.CreateRoomInviteToken(room.ID, hostID, &zeroHours, nil)
	if !errors.Is(err, ErrInviteConfig) {
		t.Fatalf("expected ErrInviteConfig for zero expires_in_hours, got %v", err)
	}

	zeroUses := 0
	_, err = service.CreateRoomInviteToken(room.ID, hostID, nil, &zeroUses)
	if !errors.Is(err, ErrInviteConfig) {
		t.Fatalf("expected ErrInviteConfig for zero max_uses, got %v", err)
	}
}

func TestInviteService_ResolveInvalidAndExpiredCode(t *testing.T) {
	db := openInviteServiceTestDB(t)
	defer db.Close()

	prepareInviteServiceTestDB(t, db)

	hostID := mustCreateInviteServiceUser(t, db, "invite-host-expired")
	guestID := mustCreateInviteServiceUser(t, db, "invite-guest-expired")

	room := mustCreateInviteServiceRoom(t, db, hostID, "Expired Invite Room")

	service := &InviteService{DB: db}

	_, err := service.ResolveJoinCodeForUser("ZZZZZZ", guestID)
	if !errors.Is(err, ErrJoinCodeInvalid) {
		t.Fatalf("expected ErrJoinCodeInvalid for unknown code, got %v", err)
	}

	invite, err := service.CreateRoomInviteToken(room.ID, hostID, nil, nil)
	if err != nil {
		t.Fatalf("expected no error creating invite, got %v", err)
	}

	_, err = db.Exec(`
		UPDATE room_invite_tokens
		SET expires_at = $2
		WHERE id = $1
	`, invite.ID, time.Now().Add(-1*time.Minute))
	if err != nil {
		t.Fatalf("could not force invite expiration: %v", err)
	}

	_, err = service.ResolveJoinCodeForUser(invite.Code, guestID)
	if !errors.Is(err, ErrJoinCodeExpired) {
		t.Fatalf("expected ErrJoinCodeExpired for expired invite, got %v", err)
	}
}

func TestInviteService_RevokeInvite_NotFound(t *testing.T) {
	db := openInviteServiceTestDB(t)
	defer db.Close()

	prepareInviteServiceTestDB(t, db)

	hostID := mustCreateInviteServiceUser(t, db, "invite-host-notfound")
	room := mustCreateInviteServiceRoom(t, db, hostID, "Revoke Missing Invite Room")

	service := &InviteService{DB: db}

	err := service.RevokeRoomInviteToken(room.ID, "00000000-0000-0000-0000-000000000000", hostID)
	if !errors.Is(err, ErrInviteNotFoundV2) {
		t.Fatalf("expected ErrInviteNotFoundV2 for missing invite, got %v", err)
	}
}

func openInviteServiceTestDB(t *testing.T) *sql.DB {
	t.Helper()

	loadInviteServiceTestEnv()

	dbName := os.Getenv("TEST_DB_NAME")
	if dbName == "" {
		dbName = os.Getenv("DB_NAME")
	}
	if dbName == "" {
		t.Fatal("TEST_DB_NAME or DB_NAME must be set")
	}

	connStr := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		os.Getenv("DB_HOST"),
		os.Getenv("DB_PORT"),
		os.Getenv("DB_USER"),
		os.Getenv("DB_PASSWORD"),
		dbName,
		inviteServiceEnvOrDefault("DB_SSLMODE", "disable"),
	)

	db, err := sql.Open("postgres", connStr)
	if err != nil {
		t.Fatalf("could not open invite service test db: %v", err)
	}

	if err := db.Ping(); err != nil {
		_ = db.Close()
		t.Fatalf("could not ping invite service test db: %v", err)
	}

	if err := applyInviteServicePhase1Migration(db); err != nil {
		_ = db.Close()
		t.Fatalf("could not apply phase1 migration in invite service tests: %v", err)
	}

	return db
}

func prepareInviteServiceTestDB(t *testing.T, db *sql.DB) {
	t.Helper()

	tableCandidates := []string{
		"room_launch_tokens",
		"room_invite_tokens",
		"invite_tokens",
		"room_members",
		"snapshots",
		"rooms",
		"users",
	}

	existing := make([]string, 0, len(tableCandidates))
	for _, tableName := range tableCandidates {
		var exists bool
		if err := db.QueryRow(`
			SELECT EXISTS (
				SELECT 1
				FROM information_schema.tables
				WHERE table_schema = 'public'
				  AND table_name = $1
			)
		`, tableName).Scan(&exists); err != nil {
			t.Fatalf("could not inspect table %q: %v", tableName, err)
		}
		if exists {
			existing = append(existing, tableName)
		}
	}

	if len(existing) == 0 {
		t.Fatal("no tables found to reset for invite service tests")
	}

	stmt := "TRUNCATE TABLE " + strings.Join(existing, ", ") + " RESTART IDENTITY CASCADE"
	if _, err := db.Exec(stmt); err != nil {
		t.Fatalf("could not reset invite service test db: %v", err)
	}
}

func mustCreateInviteServiceUser(t *testing.T, db *sql.DB, prefix string) string {
	t.Helper()

	email := fmt.Sprintf("%s-%d@example.com", prefix, time.Now().UnixNano())
	userID, err := CreateUser(db, email, "hashed-password")
	if err != nil {
		t.Fatalf("could not create test user %q: %v", email, err)
	}
	return userID
}

func mustCreateInviteServiceRoom(t *testing.T, db *sql.DB, hostID string, name string) *Room {
	t.Helper()

	roomService := &RoomService{DB: db}
	room, err := roomService.CreateRoomWithOptions(hostID, CreateRoomInput{
		Name:           name,
		SourceType:     SourceTypeLocalWorkspace,
		SourceMetadata: json.RawMessage(`{}`),
	})
	if err != nil {
		t.Fatalf("could not create test room %q: %v", name, err)
	}
	return room
}

func loadInviteServiceTestEnv() {
	candidates := []string{
		".env",
		filepath.Join("..", "..", ".env"),
		filepath.Join("..", "..", "..", ".env"),
	}

	for _, candidate := range candidates {
		if _, err := os.Stat(candidate); err == nil {
			_ = godotenv.Overload(candidate)
			return
		}
	}
}

func inviteServiceEnvOrDefault(key, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}

func applyInviteServicePhase1Migration(db *sql.DB) error {
	candidates := []string{
		filepath.Join("..", "..", "migration", "0002_phase1_control_plane.sql"),
		filepath.Join("migration", "0002_phase1_control_plane.sql"),
	}

	var migrationPath string
	for _, candidate := range candidates {
		if _, err := os.Stat(candidate); err == nil {
			migrationPath = candidate
			break
		}
	}

	if migrationPath == "" {
		return fmt.Errorf("phase1 migration file not found for invite service tests")
	}

	sqlBytes, err := os.ReadFile(migrationPath)
	if err != nil {
		return err
	}

	if strings.TrimSpace(string(sqlBytes)) == "" {
		return fmt.Errorf("phase1 migration file is empty for invite service tests")
	}

	_, err = db.Exec(string(sqlBytes))
	return err
}