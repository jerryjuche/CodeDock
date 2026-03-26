package main

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/jerryjuche/CodeDock/internal/handlers"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

func main() {

	if err := godotenv.Load(); err != nil{
		log.Println("no .env file found, reading from system environment")
		return
	}

	db, err := connectDB()
	
}