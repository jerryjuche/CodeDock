package handlers

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"sync"

	"github.com/jerryjuche/CodeDock/internal/auth"
	"github.com/jerryjuche/CodeDock/internal/services"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

var loadEnvOnce sync.Once

type testApp struct {
	db          *sql.DB
	mux         *http.ServeMux
	authHandler *AuthHandler
	roomHandler *RoomHandler
}

func setupTestApp(t *testing.T) *testApp {
	t.Helper()

	loadTestEnv(t)

	dbHost := requireEnv(t, "DB_HOST")
	dbPort := requireEnv(t, "DB_PORT")
	dbUser := requireEnv(t, "DB_USER")
	dbPassword := requireEnv(t, "DB_PASSWORD")
	testDBName := requireEnv(t, "TEST_DB_NAME")

	connStr := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		dbHost,
		dbPort,
		dbUser,
		dbPassword,
		testDBName,
	)

	db, err := sql.Open("postgres", connStr)
	if err != nil {
		t.Fatalf("could not open test database: %v", err)
	}

	if err := db.Ping(); err != nil {
		t.Fatalf(
			"could not connect to test database: %v\nconnection string used host=%s port=%s user=%s dbname=%s\nMake sure the test database exists and migrations have been run.",
			err,
			dbHost,
			dbPort,
			dbUser,
			testDBName,
		)
	}

	app := &testApp{
		db:          db,
		mux:         http.NewServeMux(),
		authHandler: &AuthHandler{DB: db},
		roomHandler: &RoomHandler{
			Services: &services.RoomService{DB: db},
		},
	}

	app.mux.HandleFunc("POST /auth/register", app.authHandler.Register)
	app.mux.HandleFunc("POST /auth/login", app.authHandler.Login)
	app.mux.Handle("POST /rooms", auth.RequireAuth(http.HandlerFunc(app.roomHandler.CreateRoom)))
	app.mux.Handle("GET /rooms", auth.RequireAuth(http.HandlerFunc(app.roomHandler.GetUserRooms)))
	app.mux.Handle("GET /rooms/{id}", auth.RequireAuth(http.HandlerFunc(app.roomHandler.GetRoom)))

	return app
}

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

func (app *testApp) postJSON(t *testing.T, path string, body interface{}, token string) *httptest.ResponseRecorder {
	t.Helper()

	b, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("could not marshal request body: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, path, bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")

	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	rr := httptest.NewRecorder()
	app.mux.ServeHTTP(rr, req)
	return rr
}

func (app *testApp) getJSON(t *testing.T, path string, token string) *httptest.ResponseRecorder {
	t.Helper()

	req := httptest.NewRequest(http.MethodGet, path, nil)

	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	rr := httptest.NewRecorder()
	app.mux.ServeHTTP(rr, req)
	return rr
}

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

	token := resp["token"]
	if token == "" {
		t.Fatalf("registerAndLogin: expected token in response")
	}

	return token
}

func TestRegister_Success(t *testing.T) {
	app := setupTestApp(t)
	defer app.db.Close()
	cleanTestDB(t, app.db)

	rr := app.postJSON(t, "/auth/register", map[string]string{
		"email":    "alice@codedock.com",
		"password": "strongpassword",
	}, "")

	if rr.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created, got %d — body: %s", rr.Code, rr.Body.String())
	}

	var resp map[string]string
	if err := json.NewDecoder(rr.Body).Decode(&resp); err != nil {
		t.Fatalf("could not decode register response: %v", err)
	}

	if resp["token"] == "" {
		t.Fatal("expected token in response, got empty string")
	}

	if resp["email"] != "alice@codedock.com" {
		t.Fatalf("expected email alice@codedock.com, got %s", resp["email"])
	}
}

func TestRegister_DuplicateEmail(t *testing.T) {
	app := setupTestApp(t)
	defer app.db.Close()
	cleanTestDB(t, app.db)

	body := map[string]string{
		"email":    "dup@codedock.com",
		"password": "password",
	}

	first := app.postJSON(t, "/auth/register", body, "")
	if first.Code != http.StatusCreated {
		t.Fatalf("expected first registration to succeed, got %d — body: %s", first.Code, first.Body.String())
	}

	rr := app.postJSON(t, "/auth/register", body, "")
	if rr.Code != http.StatusConflict {
		t.Fatalf("expected 409 for duplicate email, got %d — body: %s", rr.Code, rr.Body.String())
	}
}

func TestRegister_MissingFields(t *testing.T) {
	app := setupTestApp(t)
	defer app.db.Close()
	cleanTestDB(t, app.db)

	rr := app.postJSON(t, "/auth/register", map[string]string{
		"email": "nopw@codedock.com",
	}, "")

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for missing password, got %d — body: %s", rr.Code, rr.Body.String())
	}
}

func TestLogin_Success(t *testing.T) {
	app := setupTestApp(t)
	defer app.db.Close()
	cleanTestDB(t, app.db)

	registerRR := app.postJSON(t, "/auth/register", map[string]string{
		"email":    "bob@codedock.com",
		"password": "mypassword",
	}, "")

	if registerRR.Code != http.StatusCreated {
		t.Fatalf("expected register to succeed, got %d — body: %s", registerRR.Code, registerRR.Body.String())
	}

	rr := app.postJSON(t, "/auth/login", map[string]string{
		"email":    "bob@codedock.com",
		"password": "mypassword",
	}, "")

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d — body: %s", rr.Code, rr.Body.String())
	}

	var resp map[string]string
	if err := json.NewDecoder(rr.Body).Decode(&resp); err != nil {
		t.Fatalf("could not decode login response: %v", err)
	}

	if resp["token"] == "" {
		t.Fatal("expected token in login response")
	}
}

func TestLogin_WrongPassword(t *testing.T) {
	app := setupTestApp(t)
	defer app.db.Close()
	cleanTestDB(t, app.db)

	registerRR := app.postJSON(t, "/auth/register", map[string]string{
		"email":    "carol@codedock.com",
		"password": "correctpassword",
	}, "")

	if registerRR.Code != http.StatusCreated {
		t.Fatalf("expected register to succeed, got %d — body: %s", registerRR.Code, registerRR.Body.String())
	}

	rr := app.postJSON(t, "/auth/login", map[string]string{
		"email":    "carol@codedock.com",
		"password": "wrongpassword",
	}, "")

	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for wrong password, got %d — body: %s", rr.Code, rr.Body.String())
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
		t.Fatalf("expected 401 for unknown email, got %d — body: %s", rr.Code, rr.Body.String())
	}
}

func TestProtectedRoute_NoToken(t *testing.T) {
	app := setupTestApp(t)
	defer app.db.Close()
	cleanTestDB(t, app.db)

	rr := app.getJSON(t, "/rooms", "")
	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for missing token, got %d — body: %s", rr.Code, rr.Body.String())
	}
}

func TestProtectedRoute_InvalidToken(t *testing.T) {
	app := setupTestApp(t)
	defer app.db.Close()
	cleanTestDB(t, app.db)

	rr := app.getJSON(t, "/rooms", "this.is.not.a.valid.jwt")
	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for invalid token, got %d — body: %s", rr.Code, rr.Body.String())
	}
}

func TestCreateRoom_Success(t *testing.T) {
	app := setupTestApp(t)
	defer app.db.Close()
	cleanTestDB(t, app.db)

	token := app.registerAndLogin(t, "dave@codedock.com", "password123")

	rr := app.postJSON(t, "/rooms", map[string]string{
		"name": "Backend Sprint",
	}, token)

	if rr.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created, got %d — body: %s", rr.Code, rr.Body.String())
	}

	var room map[string]interface{}
	if err := json.NewDecoder(rr.Body).Decode(&room); err != nil {
		t.Fatalf("could not decode room response: %v", err)
	}

	if room["id"] == nil || room["id"] == "" {
		t.Fatal("expected room ID in response")
	}

	if room["name"] != "Backend Sprint" {
		t.Fatalf("expected room name 'Backend Sprint', got %v", room["name"])
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
		t.Fatalf("expected 400 for empty room name, got %d — body: %s", rr.Code, rr.Body.String())
	}
}

func TestCreateRoom_NoAuth(t *testing.T) {
	app := setupTestApp(t)
	defer app.db.Close()
	cleanTestDB(t, app.db)

	rr := app.postJSON(t, "/rooms", map[string]string{
		"name": "Secret Room",
	}, "")

	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for unauthenticated room creation, got %d — body: %s", rr.Code, rr.Body.String())
	}
}

func TestGetRoom_Success(t *testing.T) {
	app := setupTestApp(t)
	defer app.db.Close()
	cleanTestDB(t, app.db)

	token := app.registerAndLogin(t, "frank@codedock.com", "password123")

	createRR := app.postJSON(t, "/rooms", map[string]string{
		"name": "Design Review",
	}, token)

	if createRR.Code != http.StatusCreated {
		t.Fatalf("expected room creation to succeed, got %d — body: %s", createRR.Code, createRR.Body.String())
	}

	var created map[string]interface{}
	if err := json.NewDecoder(createRR.Body).Decode(&created); err != nil {
		t.Fatalf("could not decode created room: %v", err)
	}

	roomID, ok := created["id"].(string)
	if !ok || roomID == "" {
		t.Fatalf("expected room id to be a non-empty string, got %v", created["id"])
	}

	rr := app.getJSON(t, "/rooms/"+roomID, token)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d — body: %s", rr.Code, rr.Body.String())
	}

	var room map[string]interface{}
	if err := json.NewDecoder(rr.Body).Decode(&room); err != nil {
		t.Fatalf("could not decode room: %v", err)
	}

	if room["id"] != roomID {
		t.Fatalf("expected room ID %s, got %v", roomID, room["id"])
	}
}

func TestGetRoom_NotFound(t *testing.T) {
	app := setupTestApp(t)
	defer app.db.Close()
	cleanTestDB(t, app.db)

	token := app.registerAndLogin(t, "grace@codedock.com", "password123")

	rr := app.getJSON(t, "/rooms/00000000-0000-0000-0000-000000000000", token)

	if rr.Code != http.StatusNotFound {
		t.Fatalf("expected 404 for non-existent room, got %d — body: %s", rr.Code, rr.Body.String())
	}
}

func TestGetUserRooms_Success(t *testing.T) {
	app := setupTestApp(t)
	defer app.db.Close()
	cleanTestDB(t, app.db)

	token := app.registerAndLogin(t, "henry@codedock.com", "password123")

	first := app.postJSON(t, "/rooms", map[string]string{"name": "Room One"}, token)
	if first.Code != http.StatusCreated {
		t.Fatalf("expected first room creation to succeed, got %d — body: %s", first.Code, first.Body.String())
	}

	second := app.postJSON(t, "/rooms", map[string]string{"name": "Room Two"}, token)
	if second.Code != http.StatusCreated {
		t.Fatalf("expected second room creation to succeed, got %d — body: %s", second.Code, second.Body.String())
	}

	rr := app.getJSON(t, "/rooms", token)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d — body: %s", rr.Code, rr.Body.String())
	}

	var rooms []map[string]interface{}
	if err := json.NewDecoder(rr.Body).Decode(&rooms); err != nil {
		t.Fatalf("could not decode rooms response: %v", err)
	}

	if len(rooms) != 2 {
		t.Fatalf("expected 2 rooms, got %d", len(rooms))
	}
}

func TestGetUserRooms_Empty(t *testing.T) {
	app := setupTestApp(t)
	defer app.db.Close()
	cleanTestDB(t, app.db)

	token := app.registerAndLogin(t, "iris@codedock.com", "password123")

	rr := app.getJSON(t, "/rooms", token)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 OK even with no rooms, got %d — body: %s", rr.Code, rr.Body.String())
	}

	var rooms []map[string]interface{}
	if err := json.NewDecoder(rr.Body).Decode(&rooms); err != nil {
		t.Fatalf("could not decode rooms response: %v", err)
	}

	if rooms == nil {
		t.Fatal("expected empty array [], got null")
	}

	if len(rooms) != 0 {
		t.Fatalf("expected 0 rooms, got %d", len(rooms))
	}
}