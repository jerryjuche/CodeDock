package services

import (
	"database/sql"
	"errors"
)

var ErrInviteNotFound = errors.New("invite token not found")
var ErrInviteExpired = errors.New("invite token expired or already used")

type InviteDetails struct {
	RoomID   string
	RoomName string
	Email    string
}

func ExchangeInviteCode(db *sql.DB, code string) (*InviteDetails, error) {
	tx, err := db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	var details InviteDetails

	err = tx.QueryRow(`
        SELECT 
            i.room_id,
            r.name AS room_name,
            u.email
        FROM invite_tokens i
        JOIN rooms r ON i.room_id = r.id
        JOIN users u ON i.created_by = u.id
        WHERE i.token = $1
          AND i.used_at IS NULL
          AND i.expires_at > NOW()
        FOR UPDATE
    `, code).Scan(&details.RoomID, &details.RoomName, &details.Email)

	if err == sql.ErrNoRows {
		return nil, ErrInviteExpired
	}
	if err != nil {
		return nil, err
	}

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
