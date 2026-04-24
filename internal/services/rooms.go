package services

import (
	"crypto/rand"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
)

var (
	ErrRoomNameRequired = errors.New("Room name is required")
	ErrRoomNotFound     = errors.New("no room found")
	ErrRoomForbidden    = errors.New("forbidden")
	ErrInvalidSource    = errors.New("invalid source type")
)

const (
	SourceTypeLocalWorkspace = "local_workspace"
	SourceTypeGitHubRepo     = "github_repo"
)

var codeAlphabet = []byte("ABCDEFGHJKMNPQRSTVWXYZ23456789")

type Room struct {
	ID              string          `json:"id"`
	Name            string          `json:"name"`
	Slug            string          `json:"slug"`
	CreatedBy       string          `json:"created_by"`
	OwnerUserID     string          `json:"owner_user_id"`
	SourceType      string          `json:"source_type"`
	SourceMetadata  json.RawMessage `json:"source_metadata"`
	PrimaryJoinCode string          `json:"primary_join_code"`
	IsActive        bool            `json:"is_active"`
	CreatedAt       time.Time       `json:"created_at"`
	UpdatedAt       time.Time       `json:"updated_at"`
}

type CreateRoomInput struct {
	Name           string          `json:"name"`
	SourceType     string          `json:"source_type"`
	SourceMetadata json.RawMessage `json:"source_metadata"`
}

type RoomService struct {
	DB *sql.DB
}

func (s *RoomService) CreateRoom(userID string, name string) (*Room, error) {
	return s.CreateRoomWithOptions(userID, CreateRoomInput{
		Name:           name,
		SourceType:     SourceTypeLocalWorkspace,
		SourceMetadata: json.RawMessage(`{}`),
	})
}

func (s *RoomService) CreateRoomWithOptions(userID string, input CreateRoomInput) (*Room, error) {
	name := strings.TrimSpace(input.Name)
	if name == "" {
		return nil, ErrRoomNameRequired
	}

	sourceType, err := normalizeSourceType(input.SourceType)
	if err != nil {
		return nil, err
	}

	sourceMetadata, err := normalizeSourceMetadata(input.SourceMetadata)
	if err != nil {
		return nil, err
	}

	tx, err := s.DB.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	slug, err := generateUniqueRoomSlug(tx, name)
	if err != nil {
		return nil, err
	}

	joinCode, err := generateUniqueJoinCode(tx)
	if err != nil {
		return nil, err
	}

	var room Room
	var metadataBytes []byte

	err = tx.QueryRow(`
		INSERT INTO rooms (
			name,
			slug,
			created_by,
			owner_user_id,
			source_type,
			source_metadata,
			primary_join_code
		)
		VALUES ($1, $2, $3, $3, $4, $5, $6)
		RETURNING
			id,
			name,
			slug,
			created_by,
			owner_user_id,
			source_type,
			source_metadata,
			primary_join_code,
			is_active,
			created_at,
			updated_at
	`,
		name,
		slug,
		userID,
		sourceType,
		[]byte(sourceMetadata),
		joinCode,
	).Scan(
		&room.ID,
		&room.Name,
		&room.Slug,
		&room.CreatedBy,
		&room.OwnerUserID,
		&room.SourceType,
		&metadataBytes,
		&room.PrimaryJoinCode,
		&room.IsActive,
		&room.CreatedAt,
		&room.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	room.SourceMetadata = ensureJSON(metadataBytes)

	if _, err := tx.Exec(`
		INSERT INTO room_members (room_id, user_id, role)
		VALUES ($1, $2, 'host')
		ON CONFLICT (room_id, user_id) DO NOTHING
	`, room.ID, userID); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return &room, nil
}

func (s *RoomService) GetRoom(roomID string) (*Room, error) {
	var room Room
	var metadataBytes []byte

	err := s.DB.QueryRow(`
		SELECT
			id,
			name,
			slug,
			created_by,
			owner_user_id,
			source_type,
			source_metadata,
			primary_join_code,
			is_active,
			created_at,
			updated_at
		FROM rooms
		WHERE id = $1 AND is_active = TRUE
	`, roomID).Scan(
		&room.ID,
		&room.Name,
		&room.Slug,
		&room.CreatedBy,
		&room.OwnerUserID,
		&room.SourceType,
		&metadataBytes,
		&room.PrimaryJoinCode,
		&room.IsActive,
		&room.CreatedAt,
		&room.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrRoomNotFound
	}
	if err != nil {
		return nil, err
	}

	room.SourceMetadata = ensureJSON(metadataBytes)
	return &room, nil
}

func (s *RoomService) GetUserRooms(userID string) ([]Room, error) {
	rows, err := s.DB.Query(`
		SELECT
			r.id,
			r.name,
			r.slug,
			r.created_by,
			r.owner_user_id,
			r.source_type,
			r.source_metadata,
			r.primary_join_code,
			r.is_active,
			r.created_at,
			r.updated_at
		FROM rooms r
		INNER JOIN room_members rm ON rm.room_id = r.id
		WHERE rm.user_id = $1
		  AND r.is_active = TRUE
		ORDER BY r.created_at DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	rooms := make([]Room, 0)
	for rows.Next() {
		var room Room
		var metadataBytes []byte

		if err := rows.Scan(
			&room.ID,
			&room.Name,
			&room.Slug,
			&room.CreatedBy,
			&room.OwnerUserID,
			&room.SourceType,
			&metadataBytes,
			&room.PrimaryJoinCode,
			&room.IsActive,
			&room.CreatedAt,
			&room.UpdatedAt,
		); err != nil {
			return nil, err
		}

		room.SourceMetadata = ensureJSON(metadataBytes)
		rooms = append(rooms, room)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return rooms, nil
}

func (s *RoomService) IsRoomMember(roomID, userID string) (bool, error) {
	var exists bool
	err := s.DB.QueryRow(`
		SELECT EXISTS (
			SELECT 1
			FROM room_members rm
			INNER JOIN rooms r ON r.id = rm.room_id
			WHERE rm.room_id = $1
			  AND rm.user_id = $2
			  AND r.is_active = TRUE
		)
	`, roomID, userID).Scan(&exists)
	return exists, err
}

func (s *RoomService) GetUserRole(roomID, userID string) (string, error) {
	var role string
	err := s.DB.QueryRow(`
		SELECT rm.role
		FROM room_members rm
		INNER JOIN rooms r ON r.id = rm.room_id
		WHERE rm.room_id = $1
		  AND rm.user_id = $2
		  AND r.is_active = TRUE
	`, roomID, userID).Scan(&role)
	if errors.Is(err, sql.ErrNoRows) {
		return "", ErrRoomForbidden
	}
	if err != nil {
		return "", err
	}
	return role, nil
}

func normalizeSourceType(sourceType string) (string, error) {
	value := strings.TrimSpace(sourceType)
	if value == "" {
		return SourceTypeLocalWorkspace, nil
	}

	switch value {
	case SourceTypeLocalWorkspace, SourceTypeGitHubRepo:
		return value, nil
	default:
		return "", ErrInvalidSource
	}
}

func normalizeSourceMetadata(raw json.RawMessage) (json.RawMessage, error) {
	trimmed := strings.TrimSpace(string(raw))
	if trimmed == "" {
		return json.RawMessage(`{}`), nil
	}

	if !json.Valid(raw) {
		return nil, errors.New("invalid source_metadata json")
	}

	return raw, nil
}

func generateUniqueRoomSlug(tx *sql.Tx, roomName string) (string, error) {
	base := slugify(roomName)
	candidate := base

	for suffix := 1; ; suffix++ {
		var exists bool
		if err := tx.QueryRow(`
			SELECT EXISTS (
				SELECT 1 FROM rooms WHERE slug = $1
			)
		`, candidate).Scan(&exists); err != nil {
			return "", err
		}

		if !exists {
			return candidate, nil
		}

		candidate = fmt.Sprintf("%s-%d", base, suffix+1)
	}
}

func generateUniqueJoinCode(tx *sql.Tx) (string, error) {
	for attempts := 0; attempts < 32; attempts++ {
		code, err := randomCode(6)
		if err != nil {
			return "", err
		}

		var exists bool
		if err := tx.QueryRow(`
			SELECT EXISTS (
				SELECT 1 FROM rooms WHERE primary_join_code = $1
				UNION ALL
				SELECT 1 FROM room_invite_tokens WHERE code = $1
				UNION ALL
				SELECT 1 FROM invite_tokens WHERE token = $1
			)
		`, code).Scan(&exists); err != nil {
			return "", err
		}

		if !exists {
			return code, nil
		}
	}

	return "", errors.New("could not generate unique join code")
}

func slugify(name string) string {
	value := strings.ToLower(strings.TrimSpace(name))
	builder := strings.Builder{}
	lastDash := false

	for _, r := range value {
		isAlphaNum := (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9')
		if isAlphaNum {
			builder.WriteRune(r)
			lastDash = false
			continue
		}

		if !lastDash {
			builder.WriteByte('-')
			lastDash = true
		}
	}

	out := strings.Trim(builder.String(), "-")
	if out == "" {
		return "room"
	}

	return out
}

func randomCode(length int) (string, error) {
	if length <= 0 {
		return "", errors.New("invalid code length")
	}

	buf := make([]byte, length)
	max := byte(len(codeAlphabet))

	for i := 0; i < length; i++ {
		rb := make([]byte, 1)
		if _, err := rand.Read(rb); err != nil {
			return "", err
		}
		buf[i] = codeAlphabet[rb[0]%max]
	}

	return string(buf), nil
}

func ensureJSON(data []byte) json.RawMessage {
	if len(data) == 0 {
		return json.RawMessage(`{}`)
	}
	return json.RawMessage(data)
}