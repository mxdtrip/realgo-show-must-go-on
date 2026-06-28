package redis

import (
	"context"
	"fmt"

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
		client.Close()
		return nil, fmt.Errorf("failed to ping redis: %w", err)
	}

	return &Storage{Client: client}, nil
}

func (s *Storage) Close() error {
	return s.Client.Close()
}
