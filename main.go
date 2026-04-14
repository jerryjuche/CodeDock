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

	// Initialise the Hub — central registry for all WebSocket connections
	h := hub.New(snapshotStore)

	authHandler := &handlers.AuthHandler{DB: db}
	roomService := &services.RoomService{DB: db}
	roomHandler := &handlers.RoomHandler{Services: roomService}

	mux := http.NewServeMux()

	// Auth routes
	mux.HandleFunc("POST /auth/register", authHandler.Register)
	mux.HandleFunc("POST /auth/login", authHandler.Login)
	mux.HandleFunc("POST /auth/exchange", authHandler.ExchangeCode)

	// Room routes — protected
	mux.Handle("POST /rooms", auth.RequireAuth(http.HandlerFunc(roomHandler.CreateRoom)))
	mux.Handle("GET /rooms", auth.RequireAuth(http.HandlerFunc(roomHandler.GetUserRooms)))
	mux.Handle("GET /rooms/{id}", auth.RequireAuth(http.HandlerFunc(roomHandler.GetRoom)))
	

	// WebSocket route — auth handled inside the handler via query param
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
        sslmode = "disable" // safe local default
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
