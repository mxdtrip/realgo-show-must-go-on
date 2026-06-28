package main

import (
	"context"
	"log"
	"os"

	"github.com/mxdtrip/freeburger/services/api/internal/config"
	"github.com/mxdtrip/freeburger/services/api/internal/storage/postgres"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("failed to load config: %v", err)
	}

	ctx := context.Background()

	pgStorage, err := postgres.New(ctx, &cfg.Database)
	if err != nil {
		log.Fatalf("failed to connect to postgres: %v", err)
	}
	defer pgStorage.Close()

	log.Println("Successfully connected to postgres")
	log.Printf("Config loaded: env=%s", cfg.Env)
	log.Println("Shutting down...")
	os.Exit(0)
}
