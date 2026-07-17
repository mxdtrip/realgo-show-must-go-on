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
const refreshUserKeyPrefix = "auth:user-refresh:"

const rotateRefreshTokenScript = `
local user_id = redis.call("GET", KEYS[1])
if not user_id then
	return ""
end
redis.call("SET", KEYS[2], user_id, "PX", ARGV[1])
redis.call("DEL", KEYS[1])
local user_key = ARGV[2] .. user_id
redis.call("SREM", user_key, KEYS[1])
redis.call("SADD", user_key, KEYS[2])
redis.call("PEXPIRE", user_key, ARGV[1])
return user_id
`

const revokeRefreshTokenScript = `
local user_id = redis.call("GET", KEYS[1])
if user_id then
	redis.call("SREM", ARGV[1] .. user_id, KEYS[1])
end
return redis.call("DEL", KEYS[1])
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
	key := refreshKey(token)
	userKey := refreshUserKey(userID)
	_, err = s.redis.TxPipelined(ctx, func(pipe goredis.Pipeliner) error {
		pipe.Set(ctx, key, userID, s.cfg.RefreshTTL)
		pipe.SAdd(ctx, userKey, key)
		pipe.Expire(ctx, userKey, s.cfg.RefreshTTL)
		return nil
	})
	if err != nil {
		return "", fmt.Errorf("store refresh token: %w", err)
	}
	return token, nil
}

// refreshTokenUserID resolves a token without consuming it. The subsequent Lua
// rotation remains the authoritative one-time operation.
func (s *Service) refreshTokenUserID(ctx context.Context, token string) (int64, error) {
	raw, err := s.redis.Get(ctx, refreshKey(token)).Result()
	if errors.Is(err, goredis.Nil) {
		return 0, ErrInvalidToken
	}
	if err != nil {
		return 0, fmt.Errorf("lookup refresh token: %w", err)
	}
	userID, err := strconv.ParseInt(raw, 10, 64)
	if err != nil {
		return 0, fmt.Errorf("parse refresh token user id: %w", err)
	}
	return userID, nil
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
	}, s.cfg.RefreshTTL.Milliseconds(), refreshUserKeyPrefix).Result()
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
	if err := s.redis.Eval(ctx, revokeRefreshTokenScript, []string{refreshKey(token)}, refreshUserKeyPrefix).Err(); err != nil {
		return fmt.Errorf("revoke refresh token: %w", err)
	}
	return nil
}

// revokeAllRefreshTokens deletes indexed tokens and scans the legacy keyspace,
// so sessions created before the per-user index was introduced are covered too.
func (s *Service) revokeAllRefreshTokens(ctx context.Context, userID int64) error {
	wanted := strconv.FormatInt(userID, 10)
	indexed, err := s.redis.SMembers(ctx, refreshUserKey(userID)).Result()
	if err != nil {
		return fmt.Errorf("list refresh sessions: %w", err)
	}
	keys := make(map[string]struct{}, len(indexed))
	for _, key := range indexed {
		keys[key] = struct{}{}
	}

	var cursor uint64
	for {
		batch, next, scanErr := s.redis.Scan(ctx, cursor, refreshKeyPrefix+"*", 200).Result()
		if scanErr != nil {
			return fmt.Errorf("scan refresh sessions: %w", scanErr)
		}
		if len(batch) > 0 {
			values, getErr := s.redis.MGet(ctx, batch...).Result()
			if getErr != nil {
				return fmt.Errorf("read refresh sessions: %w", getErr)
			}
			for i, value := range values {
				if value != nil && fmt.Sprint(value) == wanted {
					keys[batch[i]] = struct{}{}
				}
			}
		}
		cursor = next
		if cursor == 0 {
			break
		}
	}

	deleteKeys := make([]string, 0, len(keys)+1)
	for key := range keys {
		deleteKeys = append(deleteKeys, key)
	}
	deleteKeys = append(deleteKeys, refreshUserKey(userID))
	if err := s.redis.Del(ctx, deleteKeys...).Err(); err != nil {
		return fmt.Errorf("revoke refresh sessions: %w", err)
	}
	return nil
}

func refreshKey(token string) string {
	sum := sha256.Sum256([]byte(token))
	return refreshKeyPrefix + hex.EncodeToString(sum[:])
}

func refreshUserKey(userID int64) string {
	return refreshUserKeyPrefix + strconv.FormatInt(userID, 10)
}
