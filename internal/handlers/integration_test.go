package handlers

import (
	"bytes"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/jerryjuche/CodeDock/internal/auth"
	"github.com/jerryjuche/CodeDock/internal/services"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

var testDB *sql.DB

const testDBAdvisoryLockKey int64 = 704797424

type testApp struct {
	db            *sql.DB
	mux           *http.ServeMux
	authHandler   *AuthHandler
	roomHandler   *RoomHandler
	inviteHandler *InviteHandler
	launchHandler *LaunchHandler
}

type authJSON struct {
	Token string `json:"token"`
	Email string `json:"email"`
}

type roomJSON struct {
	ID              string          `json:"id"`
	Name            string          `json:"name"`
	Slug            string          `json:"slug"`
	CreatedBy       string          `json:"created_by"`
	OwnerUserID     string          `json:"owner_user_id"`
	SourceType      string          `json:"source_type"`
	SourceMetadata  json.RawMessage `json:"source_metadata"`
	PrimaryJoinCode string          `json:"primary_join_code"`
	IsActive        bool            `json:"is_active"`
}

type membershipJSON struct {
	Role   string `json:"role"`
	Joined bool   `json:"joined"`
}

type joinCodeResponseJSON struct {
	Room       roomJSON       `json:"room"`
	Membership membershipJSON `json:"membership"`
}

type inviteJSON struct {
	ID              string     `json:"id"`
	RoomID          string     `json:"room_id"`
	Code            string     `json:"code"`
	CreatedByUserID string     `json:"created_by_user_id"`
	ExpiresAt       *time.Time `json:"expires_at"`
	MaxUses         *int       `json:"max_uses"`
	UsesCount       int        `json:"uses_count"`
	IsRevoked       bool       `json:"is_revoked"`
}

type launchTokenJSON struct {
	LaunchToken string `json:"launch_token"`
	DeepLink    string `json:"deep_link"`
}

type launchContextJSON struct {
	RoomID            string          `json:"room_id"`
	RoomName          string          `json:"room_name"`
	RoomSlug          string          `json:"room_slug"`
	Role              string          `json:"role"`
	SourceType        string          `json:"source_type"`
	SourceMetadata    json.RawMessage `json:"source_metadata"`
	WorkspacePathHint string          `json:"workspace_path_hint"`
}

func TestMain(m *testing.M) {
	loadEnv()

	connStr := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		os.Getenv("DB_HOST"),
		os.Getenv("DB_PORT"),
		os.Getenv("DB_USER"),
		os.Getenv("DB_PASSWORD"),
		os.Getenv("TEST_DB_NAME"),
		getEnvOrDefault("DB_SSLMODE", "disable"),
	)

	var err error
	testDB, err = sql.Open("postgres", connStr)
	if err != nil {
		fmt.Printf("could not open test database: %v\n", err)
		os.Exit(1)
	}

	if err := testDB.Ping(); err != nil {
		fmt.Printf("could not connect to test database: %v\n", err)
		os.Exit(1)
	}

	if _, err := testDB.Exec(`SELECT pg_advisory_lock($1)`, testDBAdvisoryLockKey); err != nil {
		fmt.Printf("could not acquire test db advisory lock: %v\n", err)
		os.Exit(1)
	}

	if err := applyPhase1Migration(testDB); err != nil {
		fmt.Printf("could not apply phase1 migration to test database: %v\n", err)
		_, _ = testDB.Exec(`SELECT pg_advisory_unlock($1)`, testDBAdvisoryLockKey)
		os.Exit(1)
	}

	code := m.Run()

	_, _ = testDB.Exec(`SELECT pg_advisory_unlock($1)`, testDBAdvisoryLockKey)
	_ = testDB.Close()
	os.Exit(code)
}

func TestAuthRegisterLoginAndDuplicateRegister(t *testing.T) {
	app := setupTestApp(t)
	resetTestDB(t, app.db)

	email := uniqueEmail("auth-register")
	password := "strong-password-123"

	registerResp := performJSONRequest(t, app.mux, http.MethodPost, "/auth/register", map[string]any{
		"email":    email,
		"password": password,
	}, "")
	assertStatus(t, registerResp, http.StatusCreated)

	var registered authJSON
	decodeJSON(t, registerResp, &registered)

	if registered.Email != email {
		t.Fatalf("expected registered email %q, got %q", email, registered.Email)
	}
	if registered.Token == "" {
		t.Fatalf("expected register token to be non-empty")
	}

	loginResp := performJSONRequest(t, app.mux, http.MethodPost, "/auth/login", map[string]any{
		"email":    email,
		"password": password,
	}, "")
	assertStatus(t, loginResp, http.StatusOK)

	var loggedIn authJSON
	decodeJSON(t, loginResp, &loggedIn)

	if loggedIn.Email != email {
		t.Fatalf("expected login email %q, got %q", email, loggedIn.Email)
	}
	if loggedIn.Token == "" {
		t.Fatalf("expected login token to be non-empty")
	}

	dupResp := performJSONRequest(t, app.mux, http.MethodPost, "/auth/register", map[string]any{
		"email":    email,
		"password": password,
	}, "")
	assertStatus(t, dupResp, http.StatusConflict)
}

func TestCreateRoomValidationAndGitHubRoomFlow(t *testing.T) {
	app := setupTestApp(t)
	resetTestDB(t, app.db)

	host := mustRegisterUser(t, app, "host-github")
	hostToken := host.Token

	invalidResp := performJSONRequest(t, app.mux, http.MethodPost, "/rooms", map[string]any{
		"name":        "Invalid Source Room",
		"source_type": "bad_source",
	}, hostToken)
	assertStatus(t, invalidResp, http.StatusBadRequest)

	roomCreateResp := performJSONRequest(t, app.mux, http.MethodPost, "/rooms", map[string]any{
		"name":        "Frontend Revamp",
		"source_type": "github_repo",
		"source_metadata": map[string]any{
			"repo_owner": "jerryjuche",
			"repo_name":  "CodeDock",
			"branch":     "staging",
		},
	}, hostToken)
	assertStatus(t, roomCreateResp, http.StatusCreated)

	var room roomJSON
	decodeJSON(t, roomCreateResp, &room)

	if room.ID == "" {
		t.Fatalf("expected room id to be non-empty")
	}
	if room.Name != "Frontend Revamp" {
		t.Fatalf("expected room name to match, got %q", room.Name)
	}
	if room.Slug == "" {
		t.Fatalf("expected slug to be non-empty")
	}
	if room.PrimaryJoinCode == "" || len(room.PrimaryJoinCode) != 6 {
		t.Fatalf("expected 6-char primary join code, got %q", room.PrimaryJoinCode)
	}
	if room.SourceType != services.SourceTypeGitHubRepo {
		t.Fatalf("expected source type %q, got %q", services.SourceTypeGitHubRepo, room.SourceType)
	}

	var sourceMeta map[string]any
	if err := json.Unmarshal(room.SourceMetadata, &sourceMeta); err != nil {
		t.Fatalf("could not decode source metadata: %v", err)
	}
	if sourceMeta["branch"] != "staging" {
		t.Fatalf("expected branch staging, got %#v", sourceMeta["branch"])
	}

	listResp := performJSONRequest(t, app.mux, http.MethodGet, "/rooms", nil, hostToken)
	assertStatus(t, listResp, http.StatusOK)

	var rooms []roomJSON
	decodeJSON(t, listResp, &rooms)

	if len(rooms) != 1 {
		t.Fatalf("expected exactly 1 room, got %d", len(rooms))
	}
	if rooms[0].ID != room.ID {
		t.Fatalf("expected listed room id %q, got %q", room.ID, rooms[0].ID)
	}

	getResp := performJSONRequest(t, app.mux, http.MethodGet, "/rooms/"+room.ID, nil, hostToken)
	assertStatus(t, getResp, http.StatusOK)

	var fetched roomJSON
	decodeJSON(t, getResp, &fetched)

	if fetched.ID != room.ID {
		t.Fatalf("expected fetched room id %q, got %q", room.ID, fetched.ID)
	}
}

func TestRoomJoinInviteAndLaunchControlPlane(t *testing.T) {
	app := setupTestApp(t)
	resetTestDB(t, app.db)

	host := mustRegisterUser(t, app, "host-local")
	guestA := mustRegisterUser(t, app, "guest-a")
	guestB := mustRegisterUser(t, app, "guest-b")
	guestC := mustRegisterUser(t, app, "guest-c")
	guestD := mustRegisterUser(t, app, "guest-d")

	hostToken := host.Token
	guestAToken := guestA.Token
	guestBToken := guestB.Token
	guestCToken := guestC.Token
	guestDToken := guestD.Token

	createRoomResp := performJSONRequest(t, app.mux, http.MethodPost, "/rooms", map[string]any{
		"name":        "Local Workspace Demo",
		"source_type": "local_workspace",
		"source_metadata": map[string]any{
			"kind": "local",
		},
	}, hostToken)
	assertStatus(t, createRoomResp, http.StatusCreated)

	var room roomJSON
	decodeJSON(t, createRoomResp, &room)

	forbiddenBeforeJoin := performJSONRequest(t, app.mux, http.MethodGet, "/rooms/"+room.ID, nil, guestAToken)
	assertStatus(t, forbiddenBeforeJoin, http.StatusForbidden)

	joinPrimaryResp := performJSONRequest(t, app.mux, http.MethodPost, "/join-code/resolve", map[string]any{
		"code": room.PrimaryJoinCode,
	}, guestAToken)
	assertStatus(t, joinPrimaryResp, http.StatusOK)

	var joinPrimary joinCodeResponseJSON
	decodeJSON(t, joinPrimaryResp, &joinPrimary)

	if joinPrimary.Room.ID != room.ID {
		t.Fatalf("expected joined room id %q, got %q", room.ID, joinPrimary.Room.ID)
	}
	if joinPrimary.Membership.Role != "editor" {
		t.Fatalf("expected editor role, got %q", joinPrimary.Membership.Role)
	}
	if !joinPrimary.Membership.Joined {
		t.Fatalf("expected first join by primary code to report joined=true")
	}

	rejoinPrimaryResp := performJSONRequest(t, app.mux, http.MethodPost, "/join-code/resolve", map[string]any{
		"code": room.PrimaryJoinCode,
	}, guestAToken)
	assertStatus(t, rejoinPrimaryResp, http.StatusOK)

	var rejoinPrimary joinCodeResponseJSON
	decodeJSON(t, rejoinPrimaryResp, &rejoinPrimary)

	if rejoinPrimary.Membership.Joined {
		t.Fatalf("expected second join by primary code to report joined=false")
	}

	getAfterJoinResp := performJSONRequest(t, app.mux, http.MethodGet, "/rooms/"+room.ID, nil, guestAToken)
	assertStatus(t, getAfterJoinResp, http.StatusOK)

	nonHostListInvitesResp := performJSONRequest(t, app.mux, http.MethodGet, "/rooms/"+room.ID+"/invites", nil, guestAToken)
	assertStatus(t, nonHostListInvitesResp, http.StatusForbidden)

	createInviteResp := performJSONRequest(t, app.mux, http.MethodPost, "/rooms/"+room.ID+"/invites", map[string]any{
		"expires_in_hours": 24,
		"max_uses":         1,
	}, hostToken)
	assertStatus(t, createInviteResp, http.StatusCreated)

	var invite inviteJSON
	decodeJSON(t, createInviteResp, &invite)

	if invite.ID == "" || invite.Code == "" {
		t.Fatalf("expected invite id and code to be non-empty")
	}
	if invite.MaxUses == nil || *invite.MaxUses != 1 {
		t.Fatalf("expected invite max_uses=1")
	}

	listInvitesResp := performJSONRequest(t, app.mux, http.MethodGet, "/rooms/"+room.ID+"/invites", nil, hostToken)
	assertStatus(t, listInvitesResp, http.StatusOK)

	var invites []inviteJSON
	decodeJSON(t, listInvitesResp, &invites)

	if len(invites) != 1 {
		t.Fatalf("expected 1 invite, got %d", len(invites))
	}
	if invites[0].Code != invite.Code {
		t.Fatalf("expected invite code %q, got %q", invite.Code, invites[0].Code)
	}

	guestBJoinInviteResp := performJSONRequest(t, app.mux, http.MethodPost, "/join-code/resolve", map[string]any{
		"code": invite.Code,
	}, guestBToken)
	assertStatus(t, guestBJoinInviteResp, http.StatusOK)

	var joinInvite joinCodeResponseJSON
	decodeJSON(t, guestBJoinInviteResp, &joinInvite)

	if !joinInvite.Membership.Joined {
		t.Fatalf("expected invite join to report joined=true")
	}
	if joinInvite.Membership.Role != "editor" {
		t.Fatalf("expected invite join role editor, got %q", joinInvite.Membership.Role)
	}

	listInvitesAfterUseResp := performJSONRequest(t, app.mux, http.MethodGet, "/rooms/"+room.ID+"/invites", nil, hostToken)
	assertStatus(t, listInvitesAfterUseResp, http.StatusOK)

	var invitesAfterUse []inviteJSON
	decodeJSON(t, listInvitesAfterUseResp, &invitesAfterUse)

	if len(invitesAfterUse) != 1 {
		t.Fatalf("expected 1 invite after use, got %d", len(invitesAfterUse))
	}
	if invitesAfterUse[0].UsesCount != 1 {
		t.Fatalf("expected uses_count=1, got %d", invitesAfterUse[0].UsesCount)
	}

	guestCJoinInviteResp := performJSONRequest(t, app.mux, http.MethodPost, "/join-code/resolve", map[string]any{
		"code": invite.Code,
	}, guestCToken)
	assertStatus(t, guestCJoinInviteResp, http.StatusGone)

	revokeInviteResp := performJSONRequest(t, app.mux, http.MethodPost, "/rooms/"+room.ID+"/invites/"+invite.ID+"/revoke", nil, hostToken)
	assertStatus(t, revokeInviteResp, http.StatusOK)

	createRevokableInviteResp := performJSONRequest(t, app.mux, http.MethodPost, "/rooms/"+room.ID+"/invites", map[string]any{
		"expires_in_hours": 24,
	}, hostToken)
	assertStatus(t, createRevokableInviteResp, http.StatusCreated)

	var revokableInvite inviteJSON
	decodeJSON(t, createRevokableInviteResp, &revokableInvite)

	revokeSecondInviteResp := performJSONRequest(t, app.mux, http.MethodPost, "/rooms/"+room.ID+"/invites/"+revokableInvite.ID+"/revoke", nil, hostToken)
	assertStatus(t, revokeSecondInviteResp, http.StatusOK)

	guestDJoinRevokedResp := performJSONRequest(t, app.mux, http.MethodPost, "/join-code/resolve", map[string]any{
		"code": revokableInvite.Code,
	}, guestDToken)
	assertStatus(t, guestDJoinRevokedResp, http.StatusGone)

	invalidInviteConfigResp := performJSONRequest(t, app.mux, http.MethodPost, "/rooms/"+room.ID+"/invites", map[string]any{
		"expires_in_hours": 0,
	}, hostToken)
	assertStatus(t, invalidInviteConfigResp, http.StatusBadRequest)

	hostLaunchResp := performJSONRequest(t, app.mux, http.MethodPost, "/rooms/"+room.ID+"/open-in-vscode", nil, hostToken)
	assertStatus(t, hostLaunchResp, http.StatusOK)

	var hostLaunch launchTokenJSON
	decodeJSON(t, hostLaunchResp, &hostLaunch)

	if hostLaunch.LaunchToken == "" {
		t.Fatalf("expected host launch token to be non-empty")
	}
	if !strings.HasPrefix(hostLaunch.DeepLink, "vscode://jerryjuche.codedock/launch?token=") {
		t.Fatalf("unexpected deep link: %q", hostLaunch.DeepLink)
	}

	exchangeHostResp := performJSONRequest(t, app.mux, http.MethodPost, "/vscode/launch/exchange", map[string]any{
		"launch_token": hostLaunch.LaunchToken,
	}, "")
	assertStatus(t, exchangeHostResp, http.StatusOK)

	var hostLaunchCtx launchContextJSON
	decodeJSON(t, exchangeHostResp, &hostLaunchCtx)

	if hostLaunchCtx.RoomID != room.ID {
		t.Fatalf("expected exchanged room id %q, got %q", room.ID, hostLaunchCtx.RoomID)
	}
	if hostLaunchCtx.Role != "host" {
		t.Fatalf("expected host launch role host, got %q", hostLaunchCtx.Role)
	}
	if !strings.Contains(hostLaunchCtx.WorkspacePathHint, room.Slug) {
		t.Fatalf("expected workspace path hint to contain slug %q, got %q", room.Slug, hostLaunchCtx.WorkspacePathHint)
	}

	reuseHostLaunchResp := performJSONRequest(t, app.mux, http.MethodPost, "/vscode/launch/exchange", map[string]any{
		"launch_token": hostLaunch.LaunchToken,
	}, "")
	assertStatus(t, reuseHostLaunchResp, http.StatusUnauthorized)

	guestLaunchResp := performJSONRequest(t, app.mux, http.MethodPost, "/rooms/"+room.ID+"/open-in-vscode", nil, guestAToken)
	assertStatus(t, guestLaunchResp, http.StatusOK)

	var guestLaunch launchTokenJSON
	decodeJSON(t, guestLaunchResp, &guestLaunch)

	exchangeGuestResp := performJSONRequest(t, app.mux, http.MethodPost, "/vscode/launch/exchange", map[string]any{
		"launch_token": guestLaunch.LaunchToken,
	}, "")
	assertStatus(t, exchangeGuestResp, http.StatusOK)

	var guestLaunchCtx launchContextJSON
	decodeJSON(t, exchangeGuestResp, &guestLaunchCtx)

	if guestLaunchCtx.Role != "editor" {
		t.Fatalf("expected guest launch role editor, got %q", guestLaunchCtx.Role)
	}

	invalidLaunchResp := performJSONRequest(t, app.mux, http.MethodPost, "/vscode/launch/exchange", map[string]any{
		"launch_token": "not-a-real-token",
	}, "")
	assertStatus(t, invalidLaunchResp, http.StatusUnauthorized)

	expiredToken := "expired-launch-token"
	expiredHash := hashLaunchTokenForTest(expiredToken)

	_, err := app.db.Exec(`
		INSERT INTO room_launch_tokens (
			room_id,
			user_id,
			intended_role,
			token_hash,
			expires_at
		)
		VALUES ($1, $2, $3, $4, $5)
	`, room.ID, guestAUserIDFromToken(t, guestAToken), "editor", expiredHash, time.Now().Add(-1*time.Minute))
	if err != nil {
		t.Fatalf("could not insert expired launch token: %v", err)
	}

	expiredLaunchResp := performJSONRequest(t, app.mux, http.MethodPost, "/vscode/launch/exchange", map[string]any{
		"launch_token": expiredToken,
	}, "")
	assertStatus(t, expiredLaunchResp, http.StatusGone)
}

func setupTestApp(t *testing.T) *testApp {
	t.Helper()

	app := &testApp{
		db:          testDB,
		authHandler: &AuthHandler{DB: testDB},
		roomHandler: &RoomHandler{
			Services: &services.RoomService{DB: testDB},
		},
		inviteHandler: &InviteHandler{
			Service: &services.InviteService{DB: testDB},
		},
		launchHandler: &LaunchHandler{
			Service: &services.LaunchService{DB: testDB},
		},
	}

	mux := http.NewServeMux()

	mux.HandleFunc("POST /auth/register", app.authHandler.Register)
	mux.HandleFunc("POST /auth/login", app.authHandler.Login)
	mux.HandleFunc("POST /auth/exchange", app.authHandler.ExchangeCode)

	mux.Handle("POST /rooms", auth.RequireAuth(http.HandlerFunc(app.roomHandler.CreateRoom)))
	mux.Handle("GET /rooms", auth.RequireAuth(http.HandlerFunc(app.roomHandler.GetUserRooms)))
	mux.Handle("GET /rooms/{id}", auth.RequireAuth(http.HandlerFunc(app.roomHandler.GetRoom)))
	mux.Handle("GET /auth/me", auth.RequireAuth(http.HandlerFunc(app.authHandler.Me)))

	mux.Handle("POST /join-code/resolve", auth.RequireAuth(http.HandlerFunc(app.inviteHandler.ResolveJoinCode)))
	mux.Handle("GET /rooms/{roomId}/invites", auth.RequireAuth(http.HandlerFunc(app.inviteHandler.ListRoomInvites)))
	mux.Handle("POST /rooms/{roomId}/invites", auth.RequireAuth(http.HandlerFunc(app.inviteHandler.CreateRoomInvite)))
	mux.Handle("POST /rooms/{roomId}/invites/{inviteId}/revoke", auth.RequireAuth(http.HandlerFunc(app.inviteHandler.RevokeRoomInvite)))

	mux.Handle("POST /rooms/{roomId}/open-in-vscode", auth.RequireAuth(http.HandlerFunc(app.launchHandler.OpenInVSCode)))
	mux.HandleFunc("POST /vscode/launch/exchange", app.launchHandler.ExchangeLaunchToken)

	app.mux = mux
	return app
}

func performJSONRequest(
	t *testing.T,
	mux *http.ServeMux,
	method string,
	path string,
	body any,
	token string,
) *httptest.ResponseRecorder {
	t.Helper()

	var reqBody []byte
	var err error

	if body != nil {
		reqBody, err = json.Marshal(body)
		if err != nil {
			t.Fatalf("could not marshal request body: %v", err)
		}
	} else {
		reqBody = []byte{}
	}

	req := httptest.NewRequest(method, path, bytes.NewReader(reqBody))
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)
	return rr
}

func decodeJSON[T any](t *testing.T, rr *httptest.ResponseRecorder, out *T) {
	t.Helper()

	if err := json.NewDecoder(rr.Body).Decode(out); err != nil {
		t.Fatalf("could not decode response JSON: %v\nbody=%s", err, rr.Body.String())
	}
}

func assertStatus(t *testing.T, rr *httptest.ResponseRecorder, expected int) {
	t.Helper()
	if rr.Code != expected {
		t.Fatalf("expected status %d, got %d, body=%s", expected, rr.Code, rr.Body.String())
	}
}

func mustRegisterUser(t *testing.T, app *testApp, prefix string) authJSON {
	t.Helper()

	email := uniqueEmail(prefix)
	password := "strong-password-123"

	rr := performJSONRequest(t, app.mux, http.MethodPost, "/auth/register", map[string]any{
		"email":    email,
		"password": password,
	}, "")
	assertStatus(t, rr, http.StatusCreated)

	var response authJSON
	decodeJSON(t, rr, &response)

	if response.Token == "" {
		t.Fatalf("expected token for registered user %q", email)
	}
	return response
}

func guestAUserIDFromToken(t *testing.T, token string) string {
	t.Helper()

	claims, err := auth.VerifyToken(token)
	if err != nil {
		t.Fatalf("could not verify token for test: %v", err)
	}
	return claims.UserID
}

func uniqueEmail(prefix string) string {
	return fmt.Sprintf("%s-%d@example.com", prefix, time.Now().UnixNano())
}

func hashLaunchTokenForTest(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func loadEnv() {
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

func getEnvOrDefault(key, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}

func applyPhase1Migration(db *sql.DB) error {
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
		return fmt.Errorf("phase1 migration file not found")
	}

	sqlBytes, err := os.ReadFile(migrationPath)
	if err != nil {
		return err
	}

	if strings.TrimSpace(string(sqlBytes)) == "" {
		return fmt.Errorf("phase1 migration file is empty")
	}

	_, err = db.Exec(string(sqlBytes))
	return err
}

func resetTestDB(t *testing.T, db *sql.DB) {
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

	existingTables := make([]string, 0, len(tableCandidates))
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
			t.Fatalf("could not determine if table %q exists: %v", tableName, err)
		}
		if exists {
			existingTables = append(existingTables, tableName)
		}
	}

	if len(existingTables) == 0 {
		t.Fatalf("no tables found to reset")
	}

	query := "TRUNCATE TABLE " + strings.Join(existingTables, ", ") + " RESTART IDENTITY CASCADE"
	if _, err := db.Exec(query); err != nil {
		t.Fatalf("could not reset test database: %v", err)
	}
}

func TestAuthMe_ReturnsCurrentUser(t *testing.T) {
	app := setupTestApp(t)
	resetTestDB(t, app.db)

	user := mustRegisterUser(t, app, "auth-me")
	token := user.Token

	rr := performJSONRequest(t, app.mux, http.MethodGet, "/auth/me", nil, token)
	assertStatus(t, rr, http.StatusOK)

	var me struct {
		ID    string `json:"id"`
		Email string `json:"email"`
	}
	decodeJSON(t, rr, &me)

	if me.ID == "" {
		t.Fatal("expected auth/me id to be non-empty")
	}
	if me.Email == "" {
		t.Fatal("expected auth/me email to be non-empty")
	}
}
