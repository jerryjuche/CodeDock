package services

import (
	"database/sql"
	"errors"
	"strings"
	"time"
)

var (
	ErrJoinCodeInvalid  = errors.New("invalid invite code")
	ErrJoinCodeExpired  = errors.New("invite code expired or unavailable")
	ErrInviteNotFoundV2 = errors.New("invite not found")
	ErrInviteConfig     = errors.New("invalid invite configuration")
)

type RoomInviteToken struct {
	ID              string     `json:"id"`
	RoomID          string     `json:"room_id"`
	Code            string     `json:"code"`
	CreatedByUserID string     `json:"created_by_user_id"`
	ExpiresAt       *time.Time `json:"expires_at"`
	MaxUses         *int       `json:"max_uses"`
	UsesCount       int        `json:"uses_count"`
	IsRevoked       bool       `json:"is_revoked"`
	CreatedAt       time.Time  `json:"created_at"`
}

type JoinCodeResolution struct {
	Room   *Room  `json:"room"`
	Role   string `json:"role"`
	Joined bool   `json:"joined"`
}

type InviteService struct {
	DB *sql.DB
}

func (s *InviteService) ResolveJoinCodeForUser(code string, userID string) (*JoinCodeResolution, error) {
	normalizedCode := strings.ToUpper(strings.TrimSpace(code))
	if normalizedCode == "" {
		return nil, ErrJoinCodeInvalid
	}

	tx, err := s.DB.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	room, err := getRoomByPrimaryCode(tx, normalizedCode)
	if err == nil {
		role, joined, err := ensureMembershipForRoom(tx, room, userID)
		if err != nil {
			return nil, err
		}
		if err := tx.Commit(); err != nil {
			return nil, err
		}
		return &JoinCodeResolution{
			Room:   room,
			Role:   role,
			Joined: joined,
		}, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}

	room, invite, err := getRoomByInviteCode(tx, normalizedCode)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrJoinCodeInvalid
		}
		return nil, err
	}

	if invite.IsRevoked {
		return nil, ErrJoinCodeExpired
	}
	if invite.ExpiresAt != nil && invite.ExpiresAt.Before(time.Now()) {
		return nil, ErrJoinCodeExpired
	}
	if invite.MaxUses != nil && invite.UsesCount >= *invite.MaxUses {
		return nil, ErrJoinCodeExpired
	}

	role, joined, err := ensureMembershipForRoom(tx, room, userID)
	if err != nil {
		return nil, err
	}

	if joined {
		if _, err := tx.Exec(`
			UPDATE room_invite_tokens
			SET uses_count = uses_count + 1
			WHERE id = $1
		`, invite.ID); err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return &JoinCodeResolution{
		Room:   room,
		Role:   role,
		Joined: joined,
	}, nil
}

func (s *InviteService) ListRoomInviteTokens(roomID, requesterUserID string) ([]RoomInviteToken, error) {
	if err := ensureHostAccess(s.DB, roomID, requesterUserID); err != nil {
		return nil, err
	}

	rows, err := s.DB.Query(`
		SELECT
			id,
			room_id,
			code,
			created_by_user_id,
			expires_at,
			max_uses,
			uses_count,
			is_revoked,
			created_at
		FROM room_invite_tokens
		WHERE room_id = $1
		ORDER BY created_at DESC
	`, roomID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	invites := make([]RoomInviteToken, 0)
	for rows.Next() {
		var invite RoomInviteToken
		var expiresAt sql.NullTime
		var maxUses sql.NullInt64

		if err := rows.Scan(
			&invite.ID,
			&invite.RoomID,
			&invite.Code,
			&invite.CreatedByUserID,
			&expiresAt,
			&maxUses,
			&invite.UsesCount,
			&invite.IsRevoked,
			&invite.CreatedAt,
		); err != nil {
			return nil, err
		}

		if expiresAt.Valid {
			value := expiresAt.Time
			invite.ExpiresAt = &value
		}
		if maxUses.Valid {
			value := int(maxUses.Int64)
			invite.MaxUses = &value
		}

		invites = append(invites, invite)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return invites, nil
}

func (s *InviteService) CreateRoomInviteToken(
	roomID string,
	requesterUserID string,
	expiresInHours *int,
	maxUses *int,
) (*RoomInviteToken, error) {
	if err := ensureHostAccess(s.DB, roomID, requesterUserID); err != nil {
		return nil, err
	}

	if expiresInHours != nil && *expiresInHours <= 0 {
		return nil, ErrInviteConfig
	}
	if maxUses != nil && *maxUses <= 0 {
		return nil, ErrInviteConfig
	}

	tx, err := s.DB.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	code, err := generateUniqueJoinCode(tx)
	if err != nil {
		return nil, err
	}

	var invite RoomInviteToken
	var expiresAt sql.NullTime
	var maxUsesValue sql.NullInt64

	if expiresInHours != nil {
		expiresAt = sql.NullTime{
			Time:  time.Now().Add(time.Duration(*expiresInHours) * time.Hour),
			Valid: true,
		}
	}
	if maxUses != nil {
		maxUsesValue = sql.NullInt64{
			Int64: int64(*maxUses),
			Valid: true,
		}
	}

	var scannedExpiresAt sql.NullTime
	var scannedMaxUses sql.NullInt64

	err = tx.QueryRow(`
		INSERT INTO room_invite_tokens (
			room_id,
			code,
			created_by_user_id,
			expires_at,
			max_uses
		)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING
			id,
			room_id,
			code,
			created_by_user_id,
			expires_at,
			max_uses,
			uses_count,
			is_revoked,
			created_at
	`, roomID, code, requesterUserID, expiresAt, maxUsesValue).Scan(
		&invite.ID,
		&invite.RoomID,
		&invite.Code,
		&invite.CreatedByUserID,
		&scannedExpiresAt,
		&scannedMaxUses,
		&invite.UsesCount,
		&invite.IsRevoked,
		&invite.CreatedAt,
	)
	if err != nil {
		return nil, err
	}

	if scannedExpiresAt.Valid {
		value := scannedExpiresAt.Time
		invite.ExpiresAt = &value
	}
	if scannedMaxUses.Valid {
		value := int(scannedMaxUses.Int64)
		invite.MaxUses = &value
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return &invite, nil
}

func (s *InviteService) RevokeRoomInviteToken(roomID, inviteID, requesterUserID string) error {
	if err := ensureHostAccess(s.DB, roomID, requesterUserID); err != nil {
		return err
	}

	result, err := s.DB.Exec(`
		UPDATE room_invite_tokens
		SET is_revoked = TRUE
		WHERE id = $1
		  AND room_id = $2
	`, inviteID, roomID)
	if err != nil {
		return err
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return ErrInviteNotFoundV2
	}

	return nil
}

func getRoomByPrimaryCode(tx *sql.Tx, code string) (*Room, error) {
	var room Room
	var metadata []byte

	err := tx.QueryRow(`
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
		WHERE primary_join_code = $1
		  AND is_active = TRUE
		FOR UPDATE
	`, code).Scan(
		&room.ID,
		&room.Name,
		&room.Slug,
		&room.CreatedBy,
		&room.OwnerUserID,
		&room.SourceType,
		&metadata,
		&room.PrimaryJoinCode,
		&room.IsActive,
		&room.CreatedAt,
		&room.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	room.SourceMetadata = ensureJSON(metadata)
	return &room, nil
}

func getRoomByInviteCode(tx *sql.Tx, code string) (*Room, *RoomInviteToken, error) {
	var room Room
	var metadata []byte
	var invite RoomInviteToken
	var expiresAt sql.NullTime
	var maxUses sql.NullInt64

	err := tx.QueryRow(`
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
			r.updated_at,
			rit.id,
			rit.room_id,
			rit.code,
			rit.created_by_user_id,
			rit.expires_at,
			rit.max_uses,
			rit.uses_count,
			rit.is_revoked,
			rit.created_at
		FROM room_invite_tokens rit
		INNER JOIN rooms r ON r.id = rit.room_id
		WHERE rit.code = $1
		  AND r.is_active = TRUE
		FOR UPDATE OF rit
	`, code).Scan(
		&room.ID,
		&room.Name,
		&room.Slug,
		&room.CreatedBy,
		&room.OwnerUserID,
		&room.SourceType,
		&metadata,
		&room.PrimaryJoinCode,
		&room.IsActive,
		&room.CreatedAt,
		&room.UpdatedAt,
		&invite.ID,
		&invite.RoomID,
		&invite.Code,
		&invite.CreatedByUserID,
		&expiresAt,
		&maxUses,
		&invite.UsesCount,
		&invite.IsRevoked,
		&invite.CreatedAt,
	)
	if err != nil {
		return nil, nil, err
	}

	room.SourceMetadata = ensureJSON(metadata)
	if expiresAt.Valid {
		value := expiresAt.Time
		invite.ExpiresAt = &value
	}
	if maxUses.Valid {
		value := int(maxUses.Int64)
		invite.MaxUses = &value
	}

	return &room, &invite, nil
}

func ensureMembershipForRoom(tx *sql.Tx, room *Room, userID string) (string, bool, error) {
	if room.OwnerUserID == userID {
		result, err := tx.Exec(`
			INSERT INTO room_members (room_id, user_id, role)
			VALUES ($1, $2, 'host')
			ON CONFLICT (room_id, user_id) DO NOTHING
		`, room.ID, userID)
		if err != nil {
			return "", false, err
		}

		rows, err := result.RowsAffected()
		if err != nil {
			return "", false, err
		}

		return "host", rows > 0, nil
	}

	var existingRole string
	err := tx.QueryRow(`
		SELECT role
		FROM room_members
		WHERE room_id = $1 AND user_id = $2
	`, room.ID, userID).Scan(&existingRole)
	if err == nil {
		return existingRole, false, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return "", false, err
	}

	result, err := tx.Exec(`
		INSERT INTO room_members (room_id, user_id, role)
		VALUES ($1, $2, 'editor')
		ON CONFLICT (room_id, user_id) DO NOTHING
	`, room.ID, userID)
	if err != nil {
		return "", false, err
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return "", false, err
	}

	if rows == 0 {
		var role string
		if err := tx.QueryRow(`
			SELECT role
			FROM room_members
			WHERE room_id = $1 AND user_id = $2
		`, room.ID, userID).Scan(&role); err != nil {
			return "", false, err
		}
		return role, false, nil
	}

	return "editor", true, nil
}

func ensureHostAccess(db *sql.DB, roomID, userID string) error {
	var role string
	err := db.QueryRow(`
		SELECT rm.role
		FROM room_members rm
		INNER JOIN rooms r ON r.id = rm.room_id
		WHERE rm.room_id = $1
		  AND rm.user_id = $2
		  AND r.is_active = TRUE
	`, roomID, userID).Scan(&role)
	if errors.Is(err, sql.ErrNoRows) {
		return ErrRoomForbidden
	}
	if err != nil {
		return err
	}
	if role != "host" {
		return ErrRoomForbidden
	}
	return nil
}
