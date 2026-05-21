package services

import (
	"database/sql"
	"encoding/json"
	"sync"
)

// fileContentCache holds the latest known text content per room+file so that
// incremental activity payloads can be applied without needing the full file.
var fileContentCache = struct {
	sync.RWMutex
	m map[string]string // key: roomID+"|"+filePath
}{m: make(map[string]string)}

// DBActivityStore implements hub.ActivityStore using PostgreSQL.
type DBActivityStore struct {
	DB *sql.DB
}

// LogActivity persists an activity event. It handles two activity types
// transparently:
//   - "file_edited"             – full-text payload, stored as-is.
//   - "file_edited_incremental" – range-based payload; the change is applied to
//     the cached content and re-emitted as "file_edited" so the rest of the
//     system sees a single unified event type.
func (s *DBActivityStore) LogActivity(roomID, userID, activityType, filePath string, details map[string]interface{}) error {
	if activityType == "file_edited_incremental" {
		start, _ := details["start"].(float64)
		delCnt, _ := details["deleteCount"].(float64)
		insert, _ := details["insert"].(string)
		lang, _ := details["language"].(string)

		cacheKey := roomID + "|" + filePath

		fileContentCache.Lock()
		current := fileContentCache.m[cacheKey]

		// Guard against out-of-range offsets (e.g. first edit before full sync)
		startOff := int(start)
		delOff := int(delCnt)
		if startOff < 0 {
			startOff = 0
		}
		if startOff > len(current) {
			startOff = len(current)
		}
		if delOff < 0 {
			delOff = 0
		}
		if startOff+delOff > len(current) {
			delOff = len(current) - startOff
		}

		newContent := current[:startOff] + insert + current[startOff+delOff:]
		fileContentCache.m[cacheKey] = newContent
		fileContentCache.Unlock()

		// Re-emit as full "file_edited" so the rest of the code stays consistent.
		details = map[string]interface{}{
			"code":     newContent,
			"language": lang,
		}
		activityType = "file_edited"
	} else if activityType == "file_edited" {
		// Update the cache whenever a full-text payload arrives.
		if code, ok := details["code"].(string); ok {
			cacheKey := roomID + "|" + filePath
			fileContentCache.Lock()
			fileContentCache.m[cacheKey] = code
			fileContentCache.Unlock()
		}
	}

	return logActivityToDB(s.DB, roomID, userID, activityType, filePath, details)
}

func logActivityToDB(db *sql.DB, roomID, userID, activityType, filePath string, details map[string]interface{}) error {
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

// LogActivity is the package-level helper retained for any direct callers.
func LogActivity(db *sql.DB, roomID, userID, activityType, filePath string, details map[string]interface{}) error {
	return logActivityToDB(db, roomID, userID, activityType, filePath, details)
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
