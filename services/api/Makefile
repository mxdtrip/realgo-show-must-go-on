GO ?= go
COMPOSE ?= docker compose -f ../../docker-compose.yml
# Server stack = base + prod overlay (vpngw, api netns, prod Caddyfile) + the
# prod-demo profile for frpc. See docker-compose.prod.yml.
PROD_COMPOSE ?= docker compose -f ../../docker-compose.yml -f ../../docker-compose.prod.yml --profile prod-demo

.PHONY: help build run test test-integration vet fmt tidy sqlc up up-api prod-demo-up down migrate seed-roadmap seed-cards seed-users reset-demo logs

help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'

build: ## Build the api binary into bin/
	$(GO) build -o bin/api ./cmd/api

run: ## Run the api on the host (requires CONFIG_PATH)
	$(GO) run ./cmd/api

test: ## Run all tests
	$(GO) test ./...

test-integration: ## Run integration tests against local Postgres and Redis
	$(GO) test -count=1 -tags=integration ./internal/integration

vet: ## Run go vet
	$(GO) vet ./...

fmt: ## Format Go sources
	$(GO) fmt ./...

tidy: ## Sync go.mod and go.sum
	$(GO) mod tidy

sqlc: ## Generate sqlc code from queries/
	$(GO) tool sqlc generate

up: ## Build and start the full stack in the background
	$(COMPOSE) up -d --build

up-api: ## Build and start only API, Postgres, Redis, migrations, and Caddy
	$(COMPOSE) up -d --build postgres redis migrate api caddy

prod-demo-up: ## Build and start the stack with the VPS reverse tunnel
	$(PROD_COMPOSE) up -d --build

down: ## Stop the stack and remove its containers
	$(COMPOSE) down

migrate: ## Apply database migrations inside the compose network
	$(COMPOSE) run --rm migrate

seed-roadmap: ## Seed the NeetCode roadmap inside the compose network
	$(COMPOSE) run --rm seed-roadmap

seed-cards: ## Seed demo Anki-style cards inside the compose network
	$(COMPOSE) run --rm seed-cards

seed-users: ## Seed demo users and review data inside the compose network
	$(COMPOSE) run --rm seed-users

reset-demo: ## Reset demo users to the seeded baseline
	$(COMPOSE) run --rm seed-users

logs: ## Follow the api logs
	$(COMPOSE) logs -f api
