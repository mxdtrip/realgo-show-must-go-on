package redis

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"time"

	goredis "github.com/redis/go-redis/v9"

	"github.com/mxdtrip/freeburger/services/api/internal/config"
)

var releaseLockScript = goredis.NewScript(`
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
end
return 0
`)

type Storage struct {
	Client *goredis.Client
}

func New(ctx context.Context, cfg *config.Redis) (*Storage, error) {
	client := goredis.NewClient(&goredis.Options{
		Addr:     cfg.Addr(),
		Password: cfg.Password,
		DB:       cfg.DB,
	})

	if err := client.Ping(ctx).Err(); err != nil {
		_ = client.Close()
		return nil, fmt.Errorf("failed to ping redis: %w", err)
	}

	return &Storage{Client: client}, nil
}

func (s *Storage) Close() error {
	return s.Client.Close()
}

// Save stores value under key. ttl=0 keeps the key without expiration.
func (s *Storage) Save(ctx context.Context, key string, value any, ttl time.Duration) error {
	if err := s.Client.Set(ctx, key, value, ttl).Err(); err != nil {
		return fmt.Errorf("redis save %q: %w", key, err)
	}
	return nil
}

// Get reads raw bytes from key.
func (s *Storage) Get(ctx context.Context, key string) ([]byte, error) {
	data, err := s.Client.Get(ctx, key).Bytes()
	if err != nil {
		return nil, fmt.Errorf("redis get %q: %w", key, err)
	}
	return data, nil
}

// SaveJSON marshals value as JSON and stores it under key.
func (s *Storage) SaveJSON(ctx context.Context, key string, value any, ttl time.Duration) error {
	data, err := json.Marshal(value)
	if err != nil {
		return fmt.Errorf("redis marshal %q: %w", key, err)
	}
	return s.Save(ctx, key, data, ttl)
}

// AcquireLock attempts to acquire a short-lived owned lock at key. The random
// token must be passed to ReleaseLock, preventing an expired holder from
// deleting a lock that a newer worker has since acquired.
func (s *Storage) AcquireLock(ctx context.Context, key string, ttl time.Duration) (token string, acquired bool, err error) {
	random := make([]byte, 32)
	if _, err := rand.Read(random); err != nil {
		return "", false, fmt.Errorf("redis generate lock owner: %w", err)
	}
	token = base64.RawURLEncoding.EncodeToString(random)

	acquired, err = s.Client.SetNX(ctx, key, token, ttl).Result()
	if err != nil {
		return "", false, fmt.Errorf("redis acquire lock %q: %w", key, err)
	}
	if !acquired {
		return "", false, nil
	}
	return token, true, nil
}

// ReleaseLock releases key only while token still owns it. A mismatched or
// already-expired lock is an idempotent no-op.
func (s *Storage) ReleaseLock(ctx context.Context, key, token string) error {
	if token == "" {
		return fmt.Errorf("redis release lock %q: empty owner token", key)
	}
	if _, err := releaseLockScript.Run(ctx, s.Client, []string{key}, token).Result(); err != nil {
		return fmt.Errorf("redis release lock %q: %w", key, err)
	}
	return nil
}

// Locked reports whether key currently exists, without attempting to acquire
// it. Used for read-only status checks (e.g. reporting "generating").
func (s *Storage) Locked(ctx context.Context, key string) (bool, error) {
	n, err := s.Client.Exists(ctx, key).Result()
	if err != nil {
		return false, fmt.Errorf("redis exists %q: %w", key, err)
	}
	return n > 0, nil
}

// GetJSON reads a JSON object from key.
func (s *Storage) GetJSON(ctx context.Context, key string) (map[string]any, error) {
	data, err := s.Get(ctx, key)
	if err != nil {
		return nil, err
	}
	var value map[string]any
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.UseNumber()
	if err := decoder.Decode(&value); err != nil {
		return nil, fmt.Errorf("redis unmarshal %q: %w", key, err)
	}
	return value, nil
}
