package main

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"

	"time"

	sentryhttp "github.com/getsentry/sentry-go/http"
	"github.com/jerryjuche/CodeDock/internal/auth"
	"github.com/jerryjuche/CodeDock/internal/handlers"
	"github.com/jerryjuche/CodeDock/internal/hub"
	"github.com/jerryjuche/CodeDock/internal/middleware"
	"github.com/jerryjuche/CodeDock/internal/observability"
	"github.com/jerryjuche/CodeDock/internal/services"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

func main() {
	if err := godotenv.Overload(); err != nil {
		log.Println("no .env file found, reading from system environment")
	}

	requireEnv("JWT_SECRET")

	flushSentry := observability.InitSentry()
	defer flushSentry()

	db, err := connectDB()
	if err != nil {
		observability.CaptureError(err)
		flushSentry()
		log.Fatalf("could not connect to database, %s", err)
	}
	defer db.Close()

	log.Println("connected to database successfully")

	snapshotStore := &services.DBSnapshotStore{DB: db}
	activityStore := &services.DBActivityStore{DB: db}
	h := hub.NewWithActivityStore(snapshotStore, activityStore)

	authHandler := &handlers.AuthHandler{DB: db}

	inviteService := &services.InviteService{DB: db}
	inviteHandler := &handlers.InviteHandler{Service: inviteService}

	launchService := &services.LaunchService{DB: db}
	launchHandler := &handlers.LaunchHandler{Service: launchService, Hub: h}

	roomService := &services.RoomService{DB: db}
	roomHandler := &handlers.RoomHandler{
		Services: roomService,
		Hub:      h,
	}

	// Rate limiters
	authLimiter := middleware.NewRateLimiter(10, time.Minute)
	wsLimiter := middleware.NewRateLimiter(100, time.Minute)

	allowedOrigins := getAllowedOrigins()

	mux := http.NewServeMux()

	mux.HandleFunc("/health", handlers.Health)
	mux.HandleFunc("/ready", handlers.Ready(db))

	// Auth routes
	mux.Handle("POST /auth/register", authLimiter.Limit(http.HandlerFunc(authHandler.Register)))
	mux.Handle("POST /auth/login", authLimiter.Limit(http.HandlerFunc(authHandler.Login)))
	mux.Handle("GET /auth/me", auth.RequireAuth(http.HandlerFunc(authHandler.Me)))

	// Legacy route kept temporarily as explicit deprecation response.
	mux.HandleFunc("POST /auth/exchange", authHandler.ExchangeCode)

	// Room routes
	mux.Handle("/rooms", auth.RequireAuth(http.HandlerFunc(roomHandler.RoomsRouter)))

	// Use more explicit patterns to ensure no conflicts
	mux.Handle("/rooms/{roomId}", auth.RequireAuth(http.HandlerFunc(roomHandler.RoomSpecificRouter)))
	mux.Handle("/rooms/{roomId}/details", auth.RequireAuth(http.HandlerFunc(roomHandler.GetRoomDetails)))
	mux.Handle("/rooms/{roomId}/presence", auth.RequireAuth(http.HandlerFunc(roomHandler.GetRoomPresence)))
	mux.Handle("/rooms/{roomId}/source/local/bind", auth.RequireAuth(http.HandlerFunc(roomHandler.BindLocalWorkspace)))
	mux.Handle("/rooms/{roomId}/activation/toggle", auth.RequireAuth(http.HandlerFunc(roomHandler.ToggleRoomActivation)))
	mux.Handle("/rooms/{roomId}/leave", auth.RequireAuth(http.HandlerFunc(roomHandler.LeaveRoom)))
	mux.Handle("/rooms/{roomId}/activities", auth.RequireAuth(http.HandlerFunc(roomHandler.GetRoomActivities)))

	// Web control-plane routes
	mux.Handle("/join-code/resolve", authLimiter.Limit(auth.RequireAuth(http.HandlerFunc(inviteHandler.ResolveJoinCode))))
	mux.Handle("/rooms/{roomId}/invites", auth.RequireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			inviteHandler.ListRoomInvites(w, r)
		case http.MethodPost:
			inviteHandler.CreateRoomInvite(w, r)
		default:
			w.Header().Set("Allow", "GET, POST")
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	})))
	mux.Handle("/rooms/{roomId}/invites/{inviteId}/revoke", auth.RequireAuth(http.HandlerFunc(inviteHandler.RevokeRoomInvite)))

	// IDE launch routes
	mux.Handle("/rooms/{roomId}/open-in-vscode", auth.RequireAuth(http.HandlerFunc(launchHandler.OpenInVSCode)))
	mux.Handle("/rooms/{roomId}/open-ide", auth.RequireAuth(http.HandlerFunc(launchHandler.OpenIDE)))
	mux.HandleFunc("/vscode/launch/exchange", launchHandler.ExchangeLaunchToken)

	// WebSocket route
	mux.Handle("/ws", wsLimiter.Limit(http.HandlerFunc(handlers.ServeWS(h, roomService, allowedOrigins))))

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("codedock server starting on port: %s", port)
	log.Printf("allowed web origins: %s", strings.Join(allowedOrigins, ", "))

	handler := withCORS(mux, allowedOrigins)

	sentryHandler := sentryhttp.New(sentryhttp.Options{
		Repanic: true,
	})

	handler = sentryHandler.Handle(handler)

	if err := http.ListenAndServe(":"+port, handler); err != nil {
		observability.CaptureError(err)
		flushSentry()
		log.Fatalf("error, server failed to start up, %s", err)
	}
}

func connectDB() (*sql.DB, error) {
	host := requireEnv("DB_HOST")
	port := requireEnv("DB_PORT")
	user := requireEnv("DB_USER")
	password := requireEnv("DB_PASSWORD")
	dbname := requireEnv("DB_NAME")
	sslmode := strings.TrimSpace(os.Getenv("DB_SSLMODE"))

	if sslmode == "" {
		sslmode = "disable"
		log.Println("DB_SSLMODE not set; defaulting to disable for local development")
	}

	connStr := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		host,
		port,
		user,
		password,
		dbname,
		sslmode,
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
		if value == "" {
			continue
		}
		if strings.Contains(value, "*") {
			log.Fatalf("WEB_ALLOWED_ORIGINS must not contain wildcard origins: %s", value)
		}
		if !strings.HasPrefix(value, "http://") && !strings.HasPrefix(value, "https://") {
			log.Fatalf("WEB_ALLOWED_ORIGINS entries must use http or https: %s", value)
		}
		out = append(out, value)
	}

	if len(out) == 0 {
		return []string{
			"http://localhost:3000",
			"http://127.0.0.1:3000",
		}
	}

	return out
}

func requireEnv(name string) string {
	value := strings.TrimSpace(os.Getenv(name))
	if value == "" {
		log.Fatalf("%s environment variable is required", name)
	}
	return value
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
