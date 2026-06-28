GO ?= go
COMPOSE ?= docker compose -f ../../docker-compose.yml

.PHONY: help build run test vet fmt tidy sqlc up down migrate logs

help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'

build: ## Build the api binary into bin/
	$(GO) build -o bin/api ./cmd/api

run: ## Run the api on the host (requires CONFIG_PATH)
	$(GO) run ./cmd/api

test: ## Run all tests
	$(GO) test ./...

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

down: ## Stop the stack and remove its containers
	$(COMPOSE) down

migrate: ## Apply database migrations inside the compose network
	$(COMPOSE) run --rm migrate

logs: ## Follow the api logs
	$(COMPOSE) logs -f api
