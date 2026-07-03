package redis

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"time"

	goredis "github.com/redis/go-redis/v9"

	"github.com/mxdtrip/freeburger/services/api/internal/config"
)

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
