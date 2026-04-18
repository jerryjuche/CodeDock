package services

import (
	"database/sql"
	"errors"
	"time"
)

var ErrInviteNotFound = errors.New("invite token not found")
var ErrInviteExpired = errors.New("invite token expired or already used")

type InviteDetails struct {
	RoomID   string
	RoomName string
	Email    string
	UserID   string
}

func ExchangeInviteCode(db *sql.DB, code string) (*InviteDetails, error) {
	tx, err := db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	var details InviteDetails
	var usedAt sql.NullTime
	var expiresAt time.Time

	// Step 1 — find token by code only, no expiry filter
	// FOR UPDATE locks the row against concurrent exchanges
	err = tx.QueryRow(`
        SELECT 
            u.id,
            i.room_id,
            r.name AS room_name,
            u.email,
            i.used_at,
            i.expires_at
        FROM invite_tokens i
        JOIN rooms r ON i.room_id = r.id
        JOIN users u ON i.created_by = u.id
        WHERE i.token = $1
        FOR UPDATE
    `, code).Scan(
		&details.UserID,
		&details.RoomID,
		&details.RoomName,
		&details.Email,
		&usedAt,
		&expiresAt,
	)

	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrInviteNotFound
	}
	if err != nil {
		return nil, err
	}

	// Step 2 — check if token is expired or already used
	if usedAt.Valid {
		return nil, ErrInviteExpired
	}
	if expiresAt.Before(time.Now()) {
		return nil, ErrInviteExpired
	}

	// Step 3 — mark as used
	result, err := tx.Exec(`
        UPDATE invite_tokens
        SET used_at = NOW()
        WHERE token = $1
          AND used_at IS NULL
          AND expires_at > NOW()
    `, code)
	if err != nil {
		return nil, err
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return nil, err
	}
	if rows == 0 {
		return nil, ErrInviteExpired
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return &details, nil
}
