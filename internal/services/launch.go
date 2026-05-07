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

	"github.com/jerryjuche/CodeDock/internal/auth"
)

var (
	ErrLaunchTokenInvalid = errors.New("invalid launch token")
	ErrLaunchTokenExpired = errors.New("launch token expired")
	ErrInvalidEditor      = errors.New("invalid editor target")
)

const (
	launchTokenTTL       = 2 * time.Minute
	extensionDeepLinkID  = "jerryjuche.codedock"
	EditorVSCode         = "vscode"
	EditorAntigravity    = "antigravity"
	URISchemeVSCode      = "vscode"
	URISchemeAntigravity = "antigravity"
)

type EditorTarget string

func (e EditorTarget) Valid() bool {
	return e == EditorVSCode || e == EditorAntigravity
}

type LaunchTokenResponse struct {
	LaunchToken string            `json:"launch_token"`
	Editor      string            `json:"editor,omitempty"`
	DeepLink    string            `json:"deep_link"`
	DeepLinks   map[string]string `json:"deep_links,omitempty"`
	ExpiresAt   string            `json:"expires_at,omitempty"`
}

type LaunchContext struct {
	RoomID            string          `json:"room_id"`
	RoomName          string          `json:"room_name"`
	RoomSlug          string          `json:"room_slug"`
	Role              string          `json:"role"`
	SourceType        string          `json:"source_type"`
	SourceMetadata    json.RawMessage `json:"source_metadata"`
	WorkspacePathHint string          `json:"workspace_path_hint"`
	AuthToken         string          `json:"auth_token"`
}

type LaunchService struct {
	DB *sql.DB
}

func (s *LaunchService) CreateRoomLaunch(roomID, userID, serverURL string) (*LaunchTokenResponse, error) {
	return s.CreateEditorLaunch(roomID, userID, EditorVSCode, serverURL)
}

func (s *LaunchService) CreateEditorLaunch(roomID, userID, editor, serverURL string) (*LaunchTokenResponse, error) {
	editorTarget := EditorTarget(editor)
	if !editorTarget.Valid() {
		return nil, ErrInvalidEditor
	}

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

	if role != "host" {
		allowed, err := s.isGuestLaunchAllowed(roomID)
		if err != nil {
			return nil, err
		}
		if !allowed {
			return nil, fmt.Errorf("room is not ready for guest launch - %w", ErrRoomNotReady)
		}
	}

	rawToken, err := generateLaunchToken()
	if err != nil {
		return nil, err
	}

	tokenHash := hashLaunchToken(rawToken)
	expiresAt := time.Now().Add(launchTokenTTL)

	_, err = s.DB.Exec(`
		INSERT INTO room_launch_tokens (
			room_id,
			user_id,
			intended_role,
			token_hash,
			expires_at
		)
		VALUES ($1, $2, $3, $4, $5)
	`, roomID, userID, role, tokenHash, expiresAt)
	if err != nil {
		return nil, err
	}

	selectedDeepLink := s.buildDeepLink(editor, rawToken, serverURL)
	selectedDeepLinks := map[string]string{editor: selectedDeepLink}

	return &LaunchTokenResponse{
		LaunchToken: rawToken,
		Editor:      editor,
		DeepLink:    selectedDeepLink,
		DeepLinks:   selectedDeepLinks,
		ExpiresAt:   expiresAt.Format(time.RFC3339),
	}, nil
}

func (s *LaunchService) buildDeepLink(editor, rawToken, serverURL string) string {
	encodedToken := url.QueryEscape(rawToken)
	encodedServerURL := url.QueryEscape(serverURL)

	if serverURL == "" {
		switch editor {
		case EditorVSCode:
			return fmt.Sprintf("%s://%s/launch?token=%s", URISchemeVSCode, extensionDeepLinkID, encodedToken)
		case EditorAntigravity:
			return fmt.Sprintf("%s://%s/launch?token=%s", URISchemeAntigravity, extensionDeepLinkID, encodedToken)
		default:
			return ""
		}
	}

	switch editor {
	case EditorVSCode:
		return fmt.Sprintf("%s://%s/launch?token=%s&server_url=%s", URISchemeVSCode, extensionDeepLinkID, encodedToken, encodedServerURL)
	case EditorAntigravity:
		return fmt.Sprintf("%s://%s/launch?token=%s&server_url=%s", URISchemeAntigravity, extensionDeepLinkID, encodedToken, encodedServerURL)
	default:
		return ""
	}
}

func (s *LaunchService) isGuestLaunchAllowed(roomID string) (bool, error) {
	var sourceType string
	var metadataBytes []byte

	err := s.DB.QueryRow(`
		SELECT source_type, source_metadata
		FROM rooms
		WHERE id = $1
		AND is_active = TRUE
	`, roomID).Scan(&sourceType, &metadataBytes)
	if errors.Is(err, sql.ErrNoRows) {
		return false, ErrRoomNotFound
	}
	if err != nil {
		return false, err
	}

	room := &Room{
		SourceType:     sourceType,
		SourceMetadata: ensureJSON(metadataBytes),
	}

	state := buildRoomSourceState(room, "editor", map[string]bool{})
	return state.LaunchAllowed, nil
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
	var userID string
	var email string
	var usedAt sql.NullTime
	var expiresAt time.Time

	err = tx.QueryRow(`
		SELECT
			rlt.used_at,
			rlt.expires_at,
			u.id,
			u.email,
			r.id,
			r.name,
			r.slug,
			rlt.intended_role,
			r.source_type,
			r.source_metadata
		FROM room_launch_tokens rlt
		INNER JOIN rooms r ON r.id = rlt.room_id
		INNER JOIN users u ON u.id = rlt.user_id
		WHERE rlt.token_hash = $1
		  AND r.is_active = TRUE
		FOR UPDATE
	`, tokenHash).Scan(
		&usedAt,
		&expiresAt,
		&userID,
		&email,
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

	authToken, err := auth.GenerateToken(userID, email)
	if err != nil {
		return nil, err
	}

	ctx.SourceMetadata = ensureJSON(metadataBytes)
	ctx.WorkspacePathHint = fmt.Sprintf("~/.codedock/rooms/%s", ctx.RoomSlug)
	ctx.AuthToken = authToken

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
