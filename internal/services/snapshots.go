package services

import (
	"database/sql"
)

// DBSnapshotStore implements hub.SnapshotStore using PostgreSQL.
type DBSnapshotStore struct {
	DB *sql.DB
}

func (s *DBSnapshotStore) Save(roomID, filePath string, state []byte) error {
	return SaveSnapshot(s.DB, roomID, filePath, state)
}

func (s *DBSnapshotStore) Get(roomID, filePath string) ([]byte, error) {
	return GetSnapshot(s.DB, roomID, filePath)
}

func SaveSnapshot(db *sql.DB, roomID, filePath string, yjsState []byte) error {
	_, err := db.Exec(`
        INSERT INTO snapshots (room_id, file_path, yjs_state)
        VALUES ($1, $2, $3)
        ON CONFLICT (room_id, file_path)
        DO UPDATE SET yjs_state = $3
    `, roomID, filePath, yjsState)
	return err
}

func GetSnapshot(db *sql.DB, roomID, filePath string) ([]byte, error) {
	var state []byte

	err := db.QueryRow(`
        SELECT yjs_state FROM snapshots
        WHERE room_id = $1 AND file_path = $2
    `, roomID, filePath).Scan(&state)

	if err == sql.ErrNoRows {
		return nil, nil
	}

	if err != nil {
		return nil, err
	}

	return state, nil
}
