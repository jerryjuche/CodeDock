package main

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/jerryjuche/CodeDock/internal/auth"
	"github.com/jerryjuche/CodeDock/internal/handlers"
	"github.com/jerryjuche/CodeDock/internal/services"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

// testApp holds everything needed to run integration tests.
// We spin up a real server against the test database —
// no mocks, no stubs. Real HTTP. Real SQL. Real results.
type testApp struct {
	db          *sql.DB
	mux         *http.ServeMux
	authHandler *handlers.AuthHandler
	roomHandler *handlers.RoomHandler
}

// setupTestApp initialises the full application stack against codedock_test.
// Called once per test file via TestMain, or per test if isolation is needed.
func setupTestApp(t *testing.T) *testApp {
	t.Helper()

	// Load environment — test DB name comes from TEST_DB_NAME
	if err := godotenv.Overload(); err != nil {
		t.Log("no .env file, reading system environment")
	}

	// Build connection string pointing at TEST database
	connStr := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		os.Getenv("DB_HOST"),
		os.Getenv("DB_PORT"),
		os.Getenv("DB_USER"),
		os.Getenv("DB_PASSWORD"),
		os.Getenv("TEST_DB_NAME"),
	)

	db, err := sql.Open("postgres", connStr)
	if err != nil {
		t.Fatalf("could not open test database: %v", err)
	}

	if err := db.Ping(); err != nil {
		t.Fatalf("could not connect to test database: %v\nMake sure codedock_test exists and migrations have been run.", err)
	}

	app := &testApp{
		db:          db,
		mux:         http.NewServeMux(),
		authHandler: &handlers.AuthHandler{DB: db},
		roomHandler: &handlers.RoomHandler{
			Services: &services.RoomService{DB: db},
		},
	}

	// Register routes — mirrors main.go exactly
	app.mux.HandleFunc("POST /auth/register", app.authHandler.Register)
	app.mux.HandleFunc("POST /auth/login", app.authHandler.Login)
	app.mux.Handle("POST /rooms", auth.RequireAuth(http.HandlerFunc(app.roomHandler.CreateRoom)))
	app.mux.Handle("GET /rooms", auth.RequireAuth(http.HandlerFunc(app.roomHandler.GetUserRooms)))
	app.mux.Handle("GET /rooms/{id}", auth.RequireAuth(http.HandlerFunc(app.roomHandler.GetRoom)))

	return app
}

// cleanTestDB wipes all test data between tests.
// Order matters — delete child tables before parent tables
// to avoid foreign key constraint violations.
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

// ── Helpers ──────────────────────────────────────────────────────────────────

// postJSON fires a POST request with a JSON body against the test server.
func (app *testApp) postJSON(t *testing.T, path string, body interface{}, token string) *httptest.ResponseRecorder {
	t.Helper()
	b, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("could not marshal request body: %v", err)
	}
	req := httptest.NewRequest("POST", path, bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	rr := httptest.NewRecorder()
	app.mux.ServeHTTP(rr, req)
	return rr
}

// getJSON fires a GET request against the test server.
func (app *testApp) getJSON(t *testing.T, path string, token string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest("GET", path, nil)
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	rr := httptest.NewRecorder()
	app.mux.ServeHTTP(rr, req)
	return rr
}

// registerAndLogin is a helper that registers a user and returns their token.
// Used to set up authenticated state for tests that need it.
func (app *testApp) registerAndLogin(t *testing.T, email, password string) string {
	t.Helper()
	rr := app.postJSON(t, "/auth/register", map[string]string{
		"email":    email,
		"password": password,
	}, "")
	if rr.Code != http.StatusCreated {
		t.Fatalf("registerAndLogin: expected 201, got %d — body: %s", rr.Code, rr.Body.String())
	}
	var resp map[string]string
	if err := json.NewDecoder(rr.Body).Decode(&resp); err != nil {
		t.Fatalf("registerAndLogin: could not decode response: %v", err)
	}
	return resp["token"]
}

// ── Auth Tests ────────────────────────────────────────────────────────────────

func TestRegister_Success(t *testing.T) {
	app := setupTestApp(t)
	defer app.db.Close()
	cleanTestDB(t, app.db)

	rr := app.postJSON(t, "/auth/register", map[string]string{
		"email":    "alice@codedock.com",
		"password": "strongpassword",
	}, "")

	if rr.Code != http.StatusCreated {
		t.Errorf("expected 201 Created, got %d — body: %s", rr.Code, rr.Body.String())
	}

	var resp map[string]string
	json.NewDecoder(rr.Body).Decode(&resp)

	if resp["token"] == "" {
		t.Error("expected token in response, got empty string")
	}
	if resp["email"] != "alice@codedock.com" {
		t.Errorf("expected email alice@codedock.com, got %s", resp["email"])
	}
}

func TestRegister_DuplicateEmail(t *testing.T) {
	app := setupTestApp(t)
	defer app.db.Close()
	cleanTestDB(t, app.db)

	body := map[string]string{"email": "dup@codedock.com", "password": "password"}

	// First registration — should succeed
	app.postJSON(t, "/auth/register", body, "")

	// Second registration with same email — should fail
	rr := app.postJSON(t, "/auth/register", body, "")
	if rr.Code != http.StatusConflict {
		t.Errorf("expected 409 for duplicate email, got %d", rr.Code)
	}
}

func TestRegister_MissingFields(t *testing.T) {
	app := setupTestApp(t)
	defer app.db.Close()
	
	cleanTestDB(t, app.db)

	rr := app.postJSON(t, "/auth/register", map[string]string{
		"email": "nopw@codedock.com",
		// password intentionally missing
	}, "")

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for missing password, got %d", rr.Code)
	}
}

func TestLogin_Success(t *testing.T) {
	app := setupTestApp(t)
	defer app.db.Close()
	cleanTestDB(t, app.db)

	// Register first
	app.postJSON(t, "/auth/register", map[string]string{
		"email":    "bob@codedock.com",
		"password": "mypassword",
	}, "")

	// Now login
	rr := app.postJSON(t, "/auth/login", map[string]string{
		"email":    "bob@codedock.com",
		"password": "mypassword",
	}, "")

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %d — body: %s", rr.Code, rr.Body.String())
	}

	var resp map[string]string
	json.NewDecoder(rr.Body).Decode(&resp)
	if resp["token"] == "" {
		t.Error("expected token in login response")
	}
}

func TestLogin_WrongPassword(t *testing.T) {
	app := setupTestApp(t)
	defer app.db.Close()
	cleanTestDB(t, app.db)

	app.postJSON(t, "/auth/register", map[string]string{
		"email":    "carol@codedock.com",
		"password": "correctpassword",
	}, "")

	rr := app.postJSON(t, "/auth/login", map[string]string{
		"email":    "carol@codedock.com",
		"password": "wrongpassword",
	}, "")

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for wrong password, got %d", rr.Code)
	}
}

func TestLogin_UnknownEmail(t *testing.T) {
	app := setupTestApp(t)
	defer app.db.Close()
	cleanTestDB(t, app.db)

	rr := app.postJSON(t, "/auth/login", map[string]string{
		"email":    "ghost@codedock.com",
		"password": "anything",
	}, "")

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for unknown email, got %d", rr.Code)
	}
}

// ── Middleware Tests ───────────────────────────────────────────────────────────

func TestProtectedRoute_NoToken(t *testing.T) {
	app := setupTestApp(t)
	defer app.db.Close()

	// Hit a protected route with no Authorization header
	rr := app.getJSON(t, "/rooms", "")
	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for missing token, got %d", rr.Code)
	}
}

func TestProtectedRoute_InvalidToken(t *testing.T) {
	app := setupTestApp(t)
	defer app.db.Close()

	rr := app.getJSON(t, "/rooms", "this.is.not.a.valid.jwt")
	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for invalid token, got %d", rr.Code)
	}
}

// ── Room Tests ────────────────────────────────────────────────────────────────

func TestCreateRoom_Success(t *testing.T) {
	app := setupTestApp(t)
	defer app.db.Close()
	cleanTestDB(t, app.db)

	token := app.registerAndLogin(t, "dave@codedock.com", "password123")

	rr := app.postJSON(t, "/rooms", map[string]string{
		"name": "Backend Sprint",
	}, token)

	if rr.Code != http.StatusCreated {
		t.Errorf("expected 201 Created, got %d — body: %s", rr.Code, rr.Body.String())
	}

	var room map[string]interface{}
	json.NewDecoder(rr.Body).Decode(&room)

	if room["id"] == "" || room["id"] == nil {
		t.Error("expected room ID in response")
	}
	if room["name"] != "Backend Sprint" {
		t.Errorf("expected room name 'Backend Sprint', got %v", room["name"])
	}
}

func TestCreateRoom_EmptyName(t *testing.T) {
	app := setupTestApp(t)
	defer app.db.Close()
	cleanTestDB(t, app.db)

	token := app.registerAndLogin(t, "eve@codedock.com", "password123")

	rr := app.postJSON(t, "/rooms", map[string]string{
		"name": "",
	}, token)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for empty room name, got %d", rr.Code)
	}
}

func TestCreateRoom_NoAuth(t *testing.T) {
	app := setupTestApp(t)
	defer app.db.Close()

	rr := app.postJSON(t, "/rooms", map[string]string{
		"name": "Secret Room",
	}, "") // no token

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for unauthenticated room creation, got %d", rr.Code)
	}
}

func TestGetRoom_Success(t *testing.T) {
	app := setupTestApp(t)
	defer app.db.Close()
	cleanTestDB(t, app.db)

	token := app.registerAndLogin(t, "frank@codedock.com", "password123")

	// Create a room first
	createRR := app.postJSON(t, "/rooms", map[string]string{
		"name": "Design Review",
	}, token)

	var created map[string]interface{}
	json.NewDecoder(createRR.Body).Decode(&created)
	roomID := created["id"].(string)

	// Now fetch it
	rr := app.getJSON(t, "/rooms/"+roomID, token)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %d — body: %s", rr.Code, rr.Body.String())
	}

	var room map[string]interface{}
	json.NewDecoder(rr.Body).Decode(&room)
	if room["id"] != roomID {
		t.Errorf("expected room ID %s, got %v", roomID, room["id"])
	}
}

func TestGetRoom_NotFound(t *testing.T) {
	app := setupTestApp(t)
	defer app.db.Close()
	cleanTestDB(t, app.db)

	token := app.registerAndLogin(t, "grace@codedock.com", "password123")

	// Use a valid UUID format that doesn't exist
	rr := app.getJSON(t, "/rooms/00000000-0000-0000-0000-000000000000", token)

	if rr.Code != http.StatusNotFound {
		t.Errorf("expected 404 for non-existent room, got %d", rr.Code)
	}
}

func TestGetUserRooms_Success(t *testing.T) {
	app := setupTestApp(t)
	defer app.db.Close()
	cleanTestDB(t, app.db)

	token := app.registerAndLogin(t, "henry@codedock.com", "password123")

	// Create two rooms
	app.postJSON(t, "/rooms", map[string]string{"name": "Room One"}, token)
	app.postJSON(t, "/rooms", map[string]string{"name": "Room Two"}, token)

	rr := app.getJSON(t, "/rooms", token)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %d — body: %s", rr.Code, rr.Body.String())
	}

	var rooms []map[string]interface{}
	json.NewDecoder(rr.Body).Decode(&rooms)

	if len(rooms) != 2 {
		t.Errorf("expected 2 rooms, got %d", len(rooms))
	}
}

func TestGetUserRooms_Empty(t *testing.T) {
	app := setupTestApp(t)
	defer app.db.Close()
	cleanTestDB(t, app.db)

	// Register but create no rooms
	token := app.registerAndLogin(t, "iris@codedock.com", "password123")

	rr := app.getJSON(t, "/rooms", token)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK even with no rooms, got %d", rr.Code)
	}

	var rooms []map[string]interface{}
	json.NewDecoder(rr.Body).Decode(&rooms)

	// Should return [] not null
	if rooms == nil {
		t.Error("expected empty array [], got null")
	}
	if len(rooms) != 0 {
		t.Errorf("expected 0 rooms, got %d", len(rooms))
	}
}
