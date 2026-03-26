package main

import (
	"log"

	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

func main() {

	if err := godotenv.Load(); err != nil {
		log.Println("no .env file found, reading from system environment")
		return
	}

	db, err := connectDB()

}
