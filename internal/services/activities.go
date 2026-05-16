package services

import (
	"database/sql"
	"encoding/json"
)

// DBActivityStore implements hub.ActivityStore using PostgreSQL.
type DBActivityStore struct {
	DB *sql.DB
}

func (s *DBActivityStore) LogActivity(roomID, userID, activityType, filePath string, details map[string]interface{}) error {
	return LogActivity(s.DB, roomID, userID, activityType, filePath, details)
}

func LogActivity(db *sql.DB, roomID, userID, activityType, filePath string, details map[string]interface{}) error {
	var detailsJSON []byte
	var err error

	if len(details) > 0 {
		detailsJSON, err = json.Marshal(details)
		if err != nil {
			return err
		}
	}

	_, err = db.Exec(`
        INSERT INTO activities (room_id, user_id, type, file_path, details)
        VALUES ($1, $2, $3, $4, $5)
    `, roomID, userID, activityType, filePath, detailsJSON)

	return err
}

func GetRoomActivities(db *sql.DB, roomID string, limit int) ([]map[string]interface{}, error) {
	if limit <= 0 {
		limit = 100
	}

	rows, err := db.Query(`
        SELECT 
            id,
            room_id,
            user_id,
            type,
            file_path,
            details,
            created_at
        FROM activities
        WHERE room_id = $1
        ORDER BY created_at DESC
        LIMIT $2
    `, roomID, limit)

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var activities []map[string]interface{}

	for rows.Next() {
		var id, roomID, userID, activityType string
		var filePath *string
		var detailsJSON sql.NullString
		var createdAt string

		err := rows.Scan(&id, &roomID, &userID, &activityType, &filePath, &detailsJSON, &createdAt)
		if err != nil {
			return nil, err
		}

		activity := map[string]interface{}{
			"id":         id,
			"room_id":    roomID,
			"user_id":    userID,
			"type":       activityType,
			"file_path":  filePath,
			"created_at": createdAt,
		}

		if detailsJSON.Valid {
			var details map[string]interface{}
			if err := json.Unmarshal([]byte(detailsJSON.String), &details); err == nil {
				activity["details"] = details
			}
		}

		activities = append(activities, activity)
	}

	return activities, rows.Err()
}

func GetUserActivitiesInRoom(db *sql.DB, roomID, userID string, limit int) ([]map[string]interface{}, error) {
	if limit <= 0 {
		limit = 50
	}

	rows, err := db.Query(`
        SELECT 
            id,
            room_id,
            user_id,
            type,
            file_path,
            details,
            created_at
        FROM activities
        WHERE room_id = $1 AND user_id = $2
        ORDER BY created_at DESC
        LIMIT $3
    `, roomID, userID, limit)

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var activities []map[string]interface{}

	for rows.Next() {
		var id, roomID, userID, activityType string
		var filePath *string
		var detailsJSON sql.NullString
		var createdAt string

		err := rows.Scan(&id, &roomID, &userID, &activityType, &filePath, &detailsJSON, &createdAt)
		if err != nil {
			return nil, err
		}

		activity := map[string]interface{}{
			"id":         id,
			"room_id":    roomID,
			"user_id":    userID,
			"type":       activityType,
			"file_path":  filePath,
			"created_at": createdAt,
		}

		if detailsJSON.Valid {
			var details map[string]interface{}
			if err := json.Unmarshal([]byte(detailsJSON.String), &details); err == nil {
				activity["details"] = details
			}
		}

		activities = append(activities, activity)
	}

	return activities, rows.Err()
}
