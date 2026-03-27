package services

import (
	"database/sql"
	"errors"
	"time"
)

type Room struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	CreatedBy string    `json:"created_by"`
	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
}

type RoomService struct {
	DB *sql.DB
}

func (s *RoomService) CreateRoom(UserID string, name string) (*Room, error) {

	if name == "" {
		return nil, errors.New("Room name is required")
	}

	tx, err := s.DB.Begin()
	if err != nil {
		return nil, err
	}

	defer tx.Rollback()

	var room Room
	err = tx.QueryRow(`INSERT INTO rooms (name, created_by) VALUES ($1, $2) RETURNING id, name, created_by, is_active, created_at`, name, UserID).Scan(&room.ID, &room.Name, &room.CreatedBy, &room.IsActive, &room.CreatedAt)
	if err != nil {
		return nil, err
	}

	_, err = tx.Exec(`INSERT INTO room_members (user_id, room_id, role) VALUES ($1, $2, 'host')`, UserID, room.ID)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return &room, nil
}

func (s *RoomService) GetRoom(roomID string) (*Room, error) {
	var room Room

	err := s.DB.QueryRow(`SELECT id, name, created_by, is_active, created_at FROM rooms WHERE id = $1 AND is_active = true`, roomID).Scan(&room.ID, &room.Name, &room.CreatedBy, &room.IsActive, &room.CreatedAt)

	if err == sql.ErrNoRows {
		return nil, errors.New("no room found")
	}

	if err != nil {
		return nil, err
	}

	return &room, nil
}

func (s *RoomService) GetUserRooms(userID string) ([]Room, error) {
	rows, err := s.DB.Query (`SELECT r.id, r.name, r.created_by, r.is_active, r.created_at FROM rooms r JOIN room_members rm ON rm.room_id = r.id WHERE rm.user_id = $1 AND r.is_active = true ORDER BY r.created_at DESC`,userID )
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	rooms := []Room{}

	for rows.Next() {
		var room Room
		if err := rows.Scan(
			&room.ID, &room.Name, &room.CreatedBy,
			&room.IsActive, &room.CreatedAt,
		); err != nil {
			return nil, err
		}
		rooms = append(rooms, room)
	}

	return rooms, nil
}
