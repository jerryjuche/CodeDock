package main

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"os"

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

	roomService := &services.RoomService{DB: db}
	roomHandler := &handlers.RoomHandler{Services: roomService}

	inviteService := &services.InviteService{DB: db}
	inviteHandler := &handlers.InviteHandler{Service: inviteService}

	launchService := &services.LaunchService{DB: db}
	launchHandler := &handlers.LaunchHandler{Service: launchService}

	mux := http.NewServeMux()

	// Auth routes
	mux.HandleFunc("POST /auth/register", authHandler.Register)
	mux.HandleFunc("POST /auth/login", authHandler.Login)

	// Legacy route kept temporarily as explicit deprecation response
	mux.HandleFunc("POST /auth/exchange", authHandler.ExchangeCode)

	// Room routes
	mux.Handle("POST /rooms", auth.RequireAuth(http.HandlerFunc(roomHandler.CreateRoom)))
	mux.Handle("GET /rooms", auth.RequireAuth(http.HandlerFunc(roomHandler.GetUserRooms)))
	mux.Handle("GET /rooms/{id}", auth.RequireAuth(http.HandlerFunc(roomHandler.GetRoom)))

	// New web control-plane routes
	mux.Handle("POST /join-code/resolve", auth.RequireAuth(http.HandlerFunc(inviteHandler.ResolveJoinCode)))
	mux.Handle("GET /rooms/{roomId}/invites", auth.RequireAuth(http.HandlerFunc(inviteHandler.ListRoomInvites)))
	mux.Handle("POST /rooms/{roomId}/invites", auth.RequireAuth(http.HandlerFunc(inviteHandler.CreateRoomInvite)))
	mux.Handle("POST /rooms/{roomId}/invites/{inviteId}/revoke", auth.RequireAuth(http.HandlerFunc(inviteHandler.RevokeRoomInvite)))

	mux.Handle("POST /rooms/{roomId}/open-in-vscode", auth.RequireAuth(http.HandlerFunc(launchHandler.OpenInVSCode)))
	mux.HandleFunc("POST /vscode/launch/exchange", launchHandler.ExchangeLaunchToken)

	// WebSocket route
	mux.HandleFunc("GET /ws", handlers.ServeWS(h))

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("codedock server starting on port: %s", port)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
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
