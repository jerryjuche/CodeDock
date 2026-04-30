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
	ErrInvalidRoomState = errors.New("invalid room state")
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

type RoomMembership struct {
	Role string `json:"role"`
}

type RoomSourceState struct {
	Type          string `json:"type"`
	Ready         bool   `json:"ready"`
	HostBound     bool   `json:"host_bound"`
	Activated     bool   `json:"activated"`
	HostConnected bool   `json:"host_connected"`
	Status        string `json:"status"`
	LaunchAllowed bool   `json:"launch_allowed"`
	LaunchReason  string `json:"launch_reason,omitempty"`

	WorkspaceLabel string `json:"workspace_label,omitempty"`

	RepoOwner string `json:"repo_owner,omitempty"`
	RepoName  string `json:"repo_name,omitempty"`
	Branch    string `json:"branch,omitempty"`
}

type RoomDetails struct {
	Room        *Room           `json:"room"`
	Membership  RoomMembership  `json:"membership"`
	SourceState RoomSourceState `json:"source_state"`
}

type RoomPresenceMember struct {
	UserID    string `json:"user_id"`
	Email     string `json:"email"`
	Role      string `json:"role"`
	Connected bool   `json:"connected"`
}

type RoomPresence struct {
	Members        []RoomPresenceMember `json:"members"`
	ConnectedCount int                  `json:"connected_count"`
	TotalMembers   int                  `json:"total_members"`
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

func (s *RoomService) GetRoomDetails(roomID, userID string, connectedUserIDs map[string]bool) (*RoomDetails, error) {
	role, err := s.GetUserRole(roomID, userID)
	if err != nil {
		return nil, err
	}

	room, err := s.GetRoom(roomID)
	if err != nil {
		return nil, err
	}

	return &RoomDetails{
		Room: room,
		Membership: RoomMembership{
			Role: role,
		},
		SourceState: buildRoomSourceState(room, role, connectedUserIDs),
	}, nil
}

func (s *RoomService) GetRoomPresence(roomID, userID string, connectedUserIDs map[string]bool) (*RoomPresence, error) {
	_, err := s.GetUserRole(roomID, userID)
	if err != nil {
		return nil, err
	}

	rows, err := s.DB.Query(`
		SELECT
			u.id,
			u.email,
			rm.role
		FROM room_members rm
		INNER JOIN users u ON u.id = rm.user_id
		INNER JOIN rooms r ON r.id = rm.room_id
		WHERE rm.room_id = $1
		  AND r.is_active = TRUE
		ORDER BY
		  CASE rm.role WHEN 'host' THEN 0 WHEN 'editor' THEN 1 ELSE 2 END,
		  u.email ASC
	`, roomID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	members := make([]RoomPresenceMember, 0)
	connectedCount := 0

	for rows.Next() {
		var member RoomPresenceMember
		if err := rows.Scan(&member.UserID, &member.Email, &member.Role); err != nil {
			return nil, err
		}

		member.Connected = connectedUserIDs[member.UserID]
		if member.Connected {
			connectedCount++
		}

		members = append(members, member)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return &RoomPresence{
		Members:        members,
		ConnectedCount: connectedCount,
		TotalMembers:   len(members),
	}, nil
}

func (s *RoomService) MarkLocalWorkspaceBound(roomID, userID, workspaceLabel string, connectedUserIDs map[string]bool) (*RoomDetails, error) {
	role, err := s.GetUserRole(roomID, userID)
	if err != nil {
		return nil, err
	}
	if role != "host" {
		return nil, ErrRoomForbidden
	}

	room, err := s.GetRoom(roomID)
	if err != nil {
		return nil, err
	}
	// Allow both local_workspace and github_repo to be "bound" by the host
	if room.SourceType != SourceTypeLocalWorkspace && room.SourceType != SourceTypeGitHubRepo {
		return nil, ErrInvalidRoomState
	}

	metadata := map[string]any{}
	if len(room.SourceMetadata) > 0 {
		_ = json.Unmarshal(room.SourceMetadata, &metadata)
	}

	metadata["workspace_bound"] = true
	metadata["activated"] = true
	metadata["ready"] = true
	metadata["status"] = "ready"
	metadata["host_selected_at"] = time.Now().UTC().Format(time.RFC3339)
	if strings.TrimSpace(workspaceLabel) != "" {
		metadata["workspace_label"] = strings.TrimSpace(workspaceLabel)
	}

	metadataBytes, err := json.Marshal(metadata)
	if err != nil {
		return nil, err
	}

	_, err = s.DB.Exec(`
		UPDATE rooms
		SET source_metadata = $2,
		    updated_at = NOW()
		WHERE id = $1
		  AND is_active = TRUE
	`, roomID, metadataBytes)
	if err != nil {
		return nil, err
	}

	return s.GetRoomDetails(roomID, userID, connectedUserIDs)
}

func (s *RoomService) ToggleRoomActivation(roomID, userID string, connectedUserIDs map[string]bool) (*RoomDetails, error) {
	room, err := s.GetRoom(roomID)
	if err != nil {
		return nil, err
	}

	if room.OwnerUserID != userID {
		return nil, ErrRoomForbidden
	}

	var metadata map[string]any
	if err := json.Unmarshal(room.SourceMetadata, &metadata); err != nil {
		metadata = make(map[string]any)
	}

	// Toggle activated state
	currentlyActivated := metadata["activated"] == true
	metadata["activated"] = !currentlyActivated
	
	// Also sync ready status
	metadata["ready"] = metadata["activated"]
	if metadata["activated"] == true {
		metadata["status"] = "ready"
	} else {
		metadata["status"] = "inactive"
	}

	metadataBytes, err := json.Marshal(metadata)
	if err != nil {
		return nil, err
	}

	if _, err := s.DB.Exec(`
		UPDATE rooms SET source_metadata = $1, updated_at = $2 WHERE id = $3
	`, metadataBytes, time.Now().UTC(), roomID); err != nil {
		return nil, err
	}

	return s.GetRoomDetails(roomID, userID, connectedUserIDs)
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

func (s *RoomService) DeleteRoom(roomID, userID string) error {
	role, err := s.GetUserRole(roomID, userID)
	if err != nil {
		return err
	}
	if role != "host" {
		return ErrRoomForbidden
	}

	result, err := s.DB.Exec(`
		UPDATE rooms
		SET is_active = FALSE,
		    updated_at = NOW()
		WHERE id = $1
		  AND owner_user_id = $2
		  AND is_active = TRUE
	`, roomID, userID)
	if err != nil {
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return ErrRoomNotFound
	}

	_, _ = s.DB.Exec(`
		UPDATE room_launch_tokens
		SET used_at = COALESCE(used_at, NOW())
		WHERE room_id = $1
		  AND used_at IS NULL
	`, roomID)

	return nil
}

func buildRoomSourceState(room *Room, role string, connectedUserIDs map[string]bool) RoomSourceState {
	state := RoomSourceState{
		Type: room.SourceType,
	}

	state.HostConnected = connectedUserIDs[room.OwnerUserID]

	switch room.SourceType {
	case SourceTypeGitHubRepo:
		var meta struct {
			RepoOwner  string `json:"repo_owner"`
			RepoName   string `json:"repo_name"`
			Branch     string `json:"branch"`
			CloneReady bool   `json:"clone_ready"`
			Ready      bool   `json:"ready"`
			Status     string `json:"status"`
		}
		_ = json.Unmarshal(room.SourceMetadata, &meta)

		state.RepoOwner = meta.RepoOwner
		state.RepoName = meta.RepoName
		state.Branch = meta.Branch

		// Check if host has "activated" the room
		var m map[string]any
		_ = json.Unmarshal(room.SourceMetadata, &m)
		state.Activated = m["activated"] == true
		state.HostBound = meta.Ready || meta.CloneReady || (meta.RepoOwner != "" && meta.RepoName != "")

		if meta.RepoOwner != "" && meta.RepoName != "" {
			if role == "host" {
				state.Ready = state.HostBound
				state.Status = "ready"
				if !state.Activated {
					state.Status = "host_activation_required"
				}
				state.LaunchAllowed = true
			} else {
				// For guests, MUST be activated
				if state.Activated {
					state.Ready = true
					state.Status = "ready"
					state.LaunchAllowed = true
				} else {
					state.Ready = false
					state.Status = "waiting_for_host"
					state.LaunchAllowed = false
					state.LaunchReason = "The host has not activated this room for guests yet."
				}
			}
		} else {
			state.Ready = false
			state.Status = "repo_not_configured"
			state.LaunchAllowed = false
			state.LaunchReason = "Repository metadata is incomplete."
		}

	case SourceTypeLocalWorkspace:
		var meta struct {
			WorkspaceBound bool   `json:"workspace_bound"`
			Activated      bool   `json:"activated"`
			Ready          bool   `json:"ready"`
			Status         string `json:"status"`
			WorkspaceLabel string `json:"workspace_label"`
		}
		_ = json.Unmarshal(room.SourceMetadata, &meta)

		state.Activated = meta.Activated
		state.HostBound = meta.WorkspaceBound || meta.Ready
		state.WorkspaceLabel = meta.WorkspaceLabel

		if role == "host" {
			state.Ready = state.HostBound
			state.Status = "ready"
			if !state.HostBound {
				state.Status = "host_workspace_required"
			} else if !state.Activated {
				state.Status = "host_activation_required"
			}
			state.LaunchAllowed = true
		} else {
			// For guests, MUST be bound AND activated
			if state.HostBound && state.Activated {
				state.Ready = true
				state.Status = "ready"
				state.LaunchAllowed = true
			} else if !state.HostBound {
				state.Ready = false
				state.Status = "waiting_for_host_workspace"
				state.LaunchAllowed = false
				state.LaunchReason = "The host has not selected a project folder yet."
			} else {
				state.Ready = false
				state.Status = "waiting_for_host"
				state.LaunchAllowed = false
				state.LaunchReason = "The host has not activated this room for guests yet."
			}
		}

	default:
		state.Status = "unknown"
		state.LaunchAllowed = false
		state.LaunchReason = "Unknown room source type."
	}

	return state
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

func (s *RoomService) CanConnectToRoom(roomID, userID string) error {
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
	if err != nil {
		return err
	}
	if !exists {
		return ErrRoomForbidden
	}

	return nil
}
