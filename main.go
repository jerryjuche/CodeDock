package main

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/jerryjuche/CodeDock/internal/auth"
	"github.com/jerryjuche/CodeDock/internal/handlers"
	"github.com/jerryjuche/CodeDock/internal/hub"
	"github.com/jerryjuche/CodeDock/internal/services"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

func main() {
	if err := godotenv.Overload(); err != nil {
		log.Println("no .env file found, reading from system environment")
	}

	db, err := connectDB()
	if err != nil {
		log.Fatalf("could not connect to database, %s", err)
		return
	}
	defer db.Close()
	log.Println("connected to database successfully")

	snapshotStore := &services.DBSnapshotStore{DB: db}
	h := hub.New(snapshotStore)

	authHandler := &handlers.AuthHandler{DB: db}

	inviteService := &services.InviteService{DB: db}
	inviteHandler := &handlers.InviteHandler{Service: inviteService}

	launchService := &services.LaunchService{DB: db}
	launchHandler := &handlers.LaunchHandler{Service: launchService}

	roomService := &services.RoomService{DB: db}
	roomHandler := &handlers.RoomHandler{
		Services: roomService,
		Hub:      h,
	}

	mux := http.NewServeMux()

	mux.HandleFunc("/health", handlers.Health)
	mux.HandleFunc("/ready", handlers.Ready(db))

	// Auth routes
	mux.HandleFunc("POST /auth/register", authHandler.Register)
	mux.HandleFunc("POST /auth/login", authHandler.Login)
	mux.Handle("GET /auth/me", auth.RequireAuth(http.HandlerFunc(authHandler.Me)))

	// Legacy route kept temporarily as explicit deprecation response
	mux.HandleFunc("POST /auth/exchange", authHandler.ExchangeCode)

	// Room routes
	mux.Handle("POST /rooms", auth.RequireAuth(http.HandlerFunc(roomHandler.CreateRoom)))
	mux.Handle("GET /rooms", auth.RequireAuth(http.HandlerFunc(roomHandler.GetUserRooms)))
	mux.Handle("GET /rooms/{roomId}", auth.RequireAuth(http.HandlerFunc(roomHandler.GetRoom)))
	mux.Handle("GET /rooms/{roomId}/details", auth.RequireAuth(http.HandlerFunc(roomHandler.GetRoomDetails)))
	mux.Handle("GET /rooms/{roomId}/presence", auth.RequireAuth(http.HandlerFunc(roomHandler.GetRoomPresence)))
	mux.Handle("POST /rooms/{roomId}/source/local/bind", auth.RequireAuth(http.HandlerFunc(roomHandler.BindLocalWorkspace)))
	mux.Handle("POST /rooms/{roomId}/activation/toggle", auth.RequireAuth(http.HandlerFunc(roomHandler.ToggleRoomActivation)))
	mux.Handle("DELETE /rooms/{roomId}", auth.RequireAuth(http.HandlerFunc(roomHandler.DeleteRoom)))

	// New web control-plane routes
	mux.Handle("POST /join-code/resolve", auth.RequireAuth(http.HandlerFunc(inviteHandler.ResolveJoinCode)))
	mux.Handle("GET /rooms/{roomId}/invites", auth.RequireAuth(http.HandlerFunc(inviteHandler.ListRoomInvites)))
	mux.Handle("POST /rooms/{roomId}/invites", auth.RequireAuth(http.HandlerFunc(inviteHandler.CreateRoomInvite)))
	mux.Handle("POST /rooms/{roomId}/invites/{inviteId}/revoke", auth.RequireAuth(http.HandlerFunc(inviteHandler.RevokeRoomInvite)))

	mux.Handle("POST /rooms/{roomId}/open-in-vscode", auth.RequireAuth(http.HandlerFunc(launchHandler.OpenInVSCode)))
	mux.Handle("POST /rooms/{roomId}/open-ide", auth.RequireAuth(http.HandlerFunc(launchHandler.OpenIDE)))
	mux.HandleFunc("POST /vscode/launch/exchange", launchHandler.ExchangeLaunchToken)

	// WebSocket route
	mux.HandleFunc("/ws", handlers.ServeWS(h, roomService))

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	allowedOrigins := getAllowedOrigins()
	log.Printf("codedock server starting on port: %s", port)
	log.Printf("allowed web origins: %s", strings.Join(allowedOrigins, ", "))

	handler := withCORS(mux, allowedOrigins)

	if err := http.ListenAndServe(":"+port, handler); err != nil {
		log.Fatalf("error, server failed to start up, %s", err)
		return
	}
}

func connectDB() (*sql.DB, error) {
	host := os.Getenv("DB_HOST")
	port := os.Getenv("DB_PORT")
	user := os.Getenv("DB_USER")
	password := os.Getenv("DB_PASSWORD")
	dbname := os.Getenv("DB_NAME")
	sslmode := os.Getenv("DB_SSLMODE")
	if sslmode == "" {
		sslmode = "disable"
	}

	connStr := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		host, port, user, password, dbname, sslmode,
	)

	db, err := sql.Open("postgres", connStr)
	if err != nil {
		return nil, err
	}
	if err := db.Ping(); err != nil {
		return nil, err
	}
	return db, nil
}

func getAllowedOrigins() []string {
	raw := strings.TrimSpace(os.Getenv("WEB_ALLOWED_ORIGINS"))
	if raw == "" {
		return []string{
			"http://localhost:3000",
			"http://127.0.0.1:3000",
		}
	}

	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		value := strings.TrimSpace(part)
		if value != "" {
			out = append(out, value)
		}
	}

	if len(out) == 0 {
		return []string{
			"http://localhost:3000",
			"http://127.0.0.1:3000",
		}
	}

	return out
}

func withCORS(next http.Handler, allowedOrigins []string) http.Handler {
	allowed := make(map[string]struct{}, len(allowedOrigins))
	for _, origin := range allowedOrigins {
		allowed[origin] = struct{}{}
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" {
			if _, ok := allowed[origin]; ok {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Vary", "Origin")
				w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
				w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
			}
		}

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}
