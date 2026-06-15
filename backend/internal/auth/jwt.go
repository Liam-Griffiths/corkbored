package auth

import (
	"errors"
	"os"

	"github.com/golang-jwt/jwt/v5"
)

// ChatClaims are embedded in the short-lived token Next.js issues before
// opening a WebSocket connection. The token is signed with AUTH_SECRET
// using HS256, matching the Next.js / Auth.js signing key.
type ChatClaims struct {
	UserID    string `json:"sub"`
	ProjectID string `json:"projectId"`
	jwt.RegisteredClaims
}

var ErrInvalidToken = errors.New("invalid or expired chat token")

// VerifyChatToken validates the HS256 token and returns the embedded claims.
func VerifyChatToken(tokenStr string) (*ChatClaims, error) {
	secret := os.Getenv("AUTH_SECRET")
	if secret == "" {
		return nil, errors.New("AUTH_SECRET not configured")
	}

	token, err := jwt.ParseWithClaims(tokenStr, &ChatClaims{}, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, ErrInvalidToken
		}
		return []byte(secret), nil
	})
	if err != nil || !token.Valid {
		return nil, ErrInvalidToken
	}

	claims, ok := token.Claims.(*ChatClaims)
	if !ok || claims.UserID == "" || claims.ProjectID == "" {
		return nil, ErrInvalidToken
	}

	return claims, nil
}
