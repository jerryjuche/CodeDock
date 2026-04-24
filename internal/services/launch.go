package services

import (
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"time"
)

var (
	ErrLaunchTokenInvalid = errors.New("invalid launch token")
	ErrLaunchTokenExpired = errors.New("launch token expired")
)

const (
	launchTokenTTL      = 2 * time.Minute
	extensionDeepLinkID = "jerryjuche.codedock"
)

type LaunchTokenResponse struct {
	LaunchToken string `json:"launch_token"`
	DeepLink    string `json:"deep_link"`
}

type LaunchContext struct {
	RoomID            string          `json:"room_id"`
	RoomName          string          `json:"room_name"`
	RoomSlug          string          `json:"room_slug"`
	Role              string          `json:"role"`
	SourceType        string          `json:"source_type"`
	SourceMetadata    json.RawMessage `json:"source_metadata"`
	WorkspacePathHint string          `json:"workspace_path_hint"`
}

type LaunchService struct {
	DB *sql.DB
}

func (s *LaunchService) CreateRoomLaunch(roomID, userID string) (*LaunchTokenResponse, error) {
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
		return nil, ErrRoomForbidden
	}
	if err != nil {
		return nil, err
	}

	rawToken, err := generateLaunchToken()
	if err != nil {
		return nil, err
	}

	tokenHash := hashLaunchToken(rawToken)

	_, err = s.DB.Exec(`
		INSERT INTO room_launch_tokens (
			room_id,
			user_id,
			intended_role,
			token_hash,
			expires_at
		)
		VALUES ($1, $2, $3, $4, $5)
	`, roomID, userID, role, tokenHash, time.Now().Add(launchTokenTTL))
	if err != nil {
		return nil, err
	}

	deepLink := fmt.Sprintf(
		"vscode://%s/launch?token=%s",
		extensionDeepLinkID,
		url.QueryEscape(rawToken),
	)

	return &LaunchTokenResponse{
		LaunchToken: rawToken,
		DeepLink:    deepLink,
	}, nil
}

func (s *LaunchService) ExchangeLaunchToken(rawToken string) (*LaunchContext, error) {
	if rawToken == "" {
		return nil, ErrLaunchTokenInvalid
	}

	tokenHash := hashLaunchToken(rawToken)

	tx, err := s.DB.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	var ctx LaunchContext
	var metadataBytes []byte
	var usedAt sql.NullTime
	var expiresAt time.Time

	err = tx.QueryRow(`
		SELECT
			rlt.used_at,
			rlt.expires_at,
			r.id,
			r.name,
			r.slug,
			rlt.intended_role,
			r.source_type,
			r.source_metadata
		FROM room_launch_tokens rlt
		INNER JOIN rooms r ON r.id = rlt.room_id
		WHERE rlt.token_hash = $1
		  AND r.is_active = TRUE
		FOR UPDATE
	`, tokenHash).Scan(
		&usedAt,
		&expiresAt,
		&ctx.RoomID,
		&ctx.RoomName,
		&ctx.RoomSlug,
		&ctx.Role,
		&ctx.SourceType,
		&metadataBytes,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrLaunchTokenInvalid
	}
	if err != nil {
		return nil, err
	}

	if usedAt.Valid {
		return nil, ErrLaunchTokenInvalid
	}
	if expiresAt.Before(time.Now()) {
		return nil, ErrLaunchTokenExpired
	}

	if _, err := tx.Exec(`
		UPDATE room_launch_tokens
		SET used_at = NOW()
		WHERE token_hash = $1
		  AND used_at IS NULL
	`, tokenHash); err != nil {
		return nil, err
	}

	ctx.SourceMetadata = ensureJSON(metadataBytes)
	ctx.WorkspacePathHint = fmt.Sprintf("~/.codedock/rooms/%s", ctx.RoomSlug)

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return &ctx, nil
}

func generateLaunchToken() (string, error) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(raw), nil
}

func hashLaunchToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}