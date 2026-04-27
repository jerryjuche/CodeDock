package auth

import (
	"context"
	"net/http"
	"strings"
)

type contextkey string

const UserContextKey contextkey = "user"

func RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, "missing authorization header", http.StatusUnauthorized)
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			http.Error(w, "invalid authorization header", http.StatusUnauthorized)
			return
		}

		//

		tokenString := parts[1]

		//verifying tokens using jwt.verifytokens function
		claims, err := VerifyToken(tokenString)
		if err != nil {
			http.Error(w, "invalid or expired token", http.StatusUnauthorized)
			return
		}

		// if token is valid, inject it into context so i can be accessable

		ctx := context.WithValue(r.Context(), UserContextKey, claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})

}

// the request context. Call this inside any protected handler to
// get the current user's identity.
func GetUserFromContext(r *http.Request) (*Claims, bool) {
	claims, ok := r.Context().Value(UserContextKey).(*Claims)
	return claims, ok
}
