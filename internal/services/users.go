package services

import (
	"database/sql"
	"errors"

	"github.com/lib/pq"
)

// ErrDuplicateEmail is returned when a registration attempt
// uses an email address that already exists in the database.
var ErrDuplicateEmail = errors.New("email already registered")

func CreateUser(db *sql.DB, email, hashedPassword string) (string, error) {
	var userID string

	err := db.QueryRow(
		`INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id`,
		email,
		hashedPassword,
	).Scan(&userID)

	if err != nil {
		// Ask: is this error a PostgreSQL-specific error?
		if pqErr, ok := err.(*pq.Error); ok {
			// 23505 is PostgreSQL's code for unique constraint violation
			if pqErr.Code == "23505" {
				return "", ErrDuplicateEmail
			}
		}
		// Any other error is a genuine infrastructure failure
		return "", err
	}

	return userID, nil
}
