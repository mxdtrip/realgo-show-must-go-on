package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/golang-jwt/jwt/v5"
	goredis "github.com/redis/go-redis/v9"
)

const refreshKeyPrefix = "auth:refresh:"

const rotateRefreshTokenScript = `
local user_id = redis.call("GET", KEYS[1])
if not user_id then
	return ""
end
redis.call("SET", KEYS[2], user_id, "PX", ARGV[1])
redis.call("DEL", KEYS[1])
return user_id
`

// TokenPair is the set of tokens issued on register, login and refresh.
type TokenPair struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int    `json:"expires_in"` // access token lifetime in seconds
}

// issueTokens mints a new access JWT plus a stored refresh token.
func (s *Service) issueTokens(ctx context.Context, userID int64, now time.Time) (TokenPair, error) {
	access, err := s.issueAccessToken(userID, now)
	if err != nil {
		return TokenPair{}, err
	}
	refresh, err := s.newRefreshToken(ctx, userID)
	if err != nil {
		return TokenPair{}, err
	}
	return s.tokenPair(access, refresh), nil
}

func (s *Service) tokenPair(access, refresh string) TokenPair {
	return TokenPair{
		AccessToken:  access,
		RefreshToken: refresh,
		TokenType:    "Bearer",
		ExpiresIn:    int(s.cfg.AccessTTL.Seconds()),
	}
}

// issueAccessToken builds a signed HS256 JWT whose subject is the user id.
func (s *Service) issueAccessToken(userID int64, now time.Time) (string, error) {
	claims := jwt.RegisteredClaims{
		Issuer:    s.cfg.Issuer,
		Subject:   strconv.FormatInt(userID, 10),
		IssuedAt:  jwt.NewNumericDate(now),
		ExpiresAt: jwt.NewNumericDate(now.Add(s.cfg.AccessTTL)),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(s.cfg.JWTSecret)
}

// ParseAccessToken validates the JWT signature, algorithm, issuer and expiry,
// returning the authenticated user id.
func (s *Service) ParseAccessToken(token string) (int64, error) {
	parsed, err := jwt.ParseWithClaims(token, &jwt.RegisteredClaims{},
		func(t *jwt.Token) (any, error) { return s.cfg.JWTSecret, nil },
		jwt.WithValidMethods([]string{"HS256"}),
		jwt.WithIssuer(s.cfg.Issuer),
	)
	if err != nil {
		return 0, ErrInvalidToken
	}
	claims, ok := parsed.Claims.(*jwt.RegisteredClaims)
	if !ok || !parsed.Valid {
		return 0, ErrInvalidToken
	}
	id, err := strconv.ParseInt(claims.Subject, 10, 64)
	if err != nil {
		return 0, ErrInvalidToken
	}
	return id, nil
}

// newRefreshToken creates an opaque token and stores it in Redis pointing at the
// user, expiring after the configured refresh TTL.
func (s *Service) newRefreshToken(ctx context.Context, userID int64) (string, error) {
	token, err := generateRefreshToken()
	if err != nil {
		return "", err
	}
	if err := s.redis.Set(ctx, refreshKey(token), userID, s.cfg.RefreshTTL).Err(); err != nil {
		return "", fmt.Errorf("store refresh token: %w", err)
	}
	return token, nil
}

func generateRefreshToken() (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}

// rotateRefreshToken atomically validates the old refresh token, stores the new
// one and deletes the old key. If Redis returns an error, the old token remains
// untouched so clients are not logged out by a partial rotation.
func (s *Service) rotateRefreshToken(ctx context.Context, token string) (int64, string, error) {
	newToken, err := generateRefreshToken()
	if err != nil {
		return 0, "", err
	}

	result, err := s.redis.Eval(ctx, rotateRefreshTokenScript, []string{
		refreshKey(token),
		refreshKey(newToken),
	}, s.cfg.RefreshTTL.Milliseconds()).Result()
	if errors.Is(err, goredis.Nil) {
		return 0, "", ErrInvalidToken
	}
	if err != nil {
		return 0, "", fmt.Errorf("rotate refresh token: %w", err)
	}
	rawUserID := fmt.Sprint(result)
	if rawUserID == "" {
		return 0, "", ErrInvalidToken
	}
	userID, err := strconv.ParseInt(rawUserID, 10, 64)
	if err != nil {
		return 0, "", fmt.Errorf("parse rotated refresh token user id: %w", err)
	}
	return userID, newToken, nil
}

// revokeRefreshToken removes a refresh token. A missing token is not an error.
func (s *Service) revokeRefreshToken(ctx context.Context, token string) error {
	if err := s.redis.Del(ctx, refreshKey(token)).Err(); err != nil {
		return fmt.Errorf("revoke refresh token: %w", err)
	}
	return nil
}

func refreshKey(token string) string {
	sum := sha256.Sum256([]byte(token))
	return refreshKeyPrefix + hex.EncodeToString(sum[:])
}
