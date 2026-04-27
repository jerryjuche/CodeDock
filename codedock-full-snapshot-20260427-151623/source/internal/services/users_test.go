package services

import (
	"errors"
	"testing"
)

func TestCreateUser_Success(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	cleanTestDB(t, db)

	userID, err := CreateUser(db, "users-success@codedock.com", "hashed-password")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if userID == "" {
		t.Fatal("expected created user ID, got empty string")
	}
}

func TestCreateUser_DuplicateEmailReturnsErrDuplicateEmail(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	cleanTestDB(t, db)

	_, err := CreateUser(db, "users-duplicate@codedock.com", "hashed-password")
	if err != nil {
		t.Fatalf("expected first create to succeed, got %v", err)
	}

	_, err = CreateUser(db, "users-duplicate@codedock.com", "another-password")
	if err == nil {
		t.Fatal("expected duplicate email error, got nil")
	}

	if !errors.Is(err, ErrDuplicateEmail) {
		t.Fatalf("expected ErrDuplicateEmail, got %v", err)
	}
}