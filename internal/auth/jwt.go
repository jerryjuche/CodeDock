package auth

import (
	"errors"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func getSecret() []byte {

	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		panic("JWT_SECRET ENVIRONMENT VARIABLE IS NOT SET!!")

	}
	return []byte(secret)

}

type Claims struct {
	UserID string `json:"user_id"`
	Email  string `json:"email"`
	jwt.RegisteredClaims
}

// GenerateTokens creates a signed jwt token for every authenticated user
// returns the token string, or an error if signing fails
func GenerateToken(userID string, email string) (string, error) {

	claims := Claims{
		UserID: userID,
		Email:  email,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "codedock",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(getSecret())

}

func VerifyToken(tokenString string) (*Claims, error) {

	token, err := jwt.ParseWithClaims(
		tokenString,
		&Claims{},

		func(token *jwt.Token) (interface{}, error) {
			// verify if the signing methoh is HMAC
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, errors.New("unexpected signing method")
			}
			return getSecret(), nil
		},
	)

	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid tokens")
	}

	return claims, nil

}
