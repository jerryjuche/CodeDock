package services

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"testing"

	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

const servicesTestDBAdvisoryLockKey int64 = 704797424

var servicesTestLockDB *sql.DB

func TestMain(m *testing.M) {
	loadServicesPackageTestEnv()

	dbName := os.Getenv("TEST_DB_NAME")
	if dbName == "" {
		dbName = os.Getenv("DB_NAME")
	}
	if dbName == "" {
		fmt.Println("TEST_DB_NAME or DB_NAME must be set")
		os.Exit(1)
	}

	connStr := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		os.Getenv("DB_HOST"),
		os.Getenv("DB_PORT"),
		os.Getenv("DB_USER"),
		os.Getenv("DB_PASSWORD"),
		dbName,
		servicesPackageEnvOrDefault("DB_SSLMODE", "disable"),
	)

	var err error
	servicesTestLockDB, err = sql.Open("postgres", connStr)
	if err != nil {
		fmt.Printf("could not open services test database: %v\n", err)
		os.Exit(1)
	}

	if err := servicesTestLockDB.Ping(); err != nil {
		fmt.Printf("could not connect to services test database: %v\n", err)
		os.Exit(1)
	}

	if _, err := servicesTestLockDB.Exec(`SELECT pg_advisory_lock($1)`, servicesTestDBAdvisoryLockKey); err != nil {
		fmt.Printf("could not acquire services test advisory lock: %v\n", err)
		os.Exit(1)
	}

	code := m.Run()

	_, _ = servicesTestLockDB.Exec(`SELECT pg_advisory_unlock($1)`, servicesTestDBAdvisoryLockKey)
	_ = servicesTestLockDB.Close()
	os.Exit(code)
}

func loadServicesPackageTestEnv() {
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

func servicesPackageEnvOrDefault(key, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}