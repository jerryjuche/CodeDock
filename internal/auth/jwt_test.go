package auth

import (
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
)

func TestRequireAuth_NoAuthorizationHeader(t *testing.T) {
	os.Setenv("JWT_SECRET", "testsecretthatisveryverylongandverysecure123456")

	handler := RequireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/rooms", nil)
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for missing header, got %d", rr.Code)
	}
}

func TestRequireAuth_MalformedHeader(t *testing.T) {
	os.Setenv("JWT_SECRET", "testsecretthatisveryverylongandverysecure123456")

	handler := RequireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/rooms", nil)
	req.Header.Set("Authorization", "NotBearer sometoken")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for malformed header, got %d", rr.Code)
	}
}

func TestRequireAuth_BearerPrefixOnlyNoToken(t *testing.T) {
	os.Setenv("JWT_SECRET", "testsecretthatisveryverylongandverysecure123456")

	handler := RequireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/rooms", nil)
	req.Header.Set("Authorization", "Bearer ")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for empty token after Bearer, got %d", rr.Code)
	}
}

func TestRequireAuth_InvalidToken(t *testing.T) {
	os.Setenv("JWT_SECRET", "testsecretthatisveryverylongandverysecure123456")

	handler := RequireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/rooms", nil)
	req.Header.Set("Authorization", "Bearer this.is.not.valid")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for invalid token, got %d", rr.Code)
	}
}

func TestRequireAuth_ValidToken_CallsNextHandler(t *testing.T) {
	os.Setenv("JWT_SECRET", "testsecretthatisveryverylongandverysecure123456")

	token, err := GenerateToken("user-middleware", "middleware@codedock.com")
	if err != nil {
		t.Fatalf("could not generate token: %v", err)
	}

	nextCalled := false
	handler := RequireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		nextCalled = true
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/rooms", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 for valid token, got %d", rr.Code)
	}
	if !nextCalled {
		t.Error("expected next handler to be called, but it was not")
	}
}

func TestRequireAuth_ValidToken_SetsUserContext(t *testing.T) {
	os.Setenv("JWT_SECRET", "testsecretthatisveryverylongandverysecure123456")

	token, err := GenerateToken("context-user-id", "context@codedock.com")
	if err != nil {
		t.Fatalf("could not generate token: %v", err)
	}

	handler := RequireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user, ok := GetUserFromContext(r)
		if !ok || user == nil {
			t.Error("expected claims in context, got nil")
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		if user.UserID != "context-user-id" {
			t.Errorf("expected userID context-user-id, got %s", user.UserID)
		}
		if user.Email != "context@codedock.com" {
			t.Errorf("expected email context@codedock.com, got %s", user.Email)
		}
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/rooms", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rr.Code)
	}
}

func TestGetUserFromContext_EmptyContext(t *testing.T) {
	req := httptest.NewRequest("GET", "/rooms", nil)
	user, ok := GetUserFromContext(req)
	if ok || user != nil {
		t.Errorf("expected nil claims from empty context, got %+v", user)
	}

	if user != nil {
		t.Errorf("expected nil user from empty context, got %+v", user)
	}
}
