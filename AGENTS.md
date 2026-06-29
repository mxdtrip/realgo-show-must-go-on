# Repository Guidelines

## Project Structure & Module Organization

FreeBurger is a monorepo. The active backend lives in `services/api`: `cmd/api` is the entry point, `internal` contains server, auth, reviews, config, and storage code, `queries` and `sqlc.yaml` drive generated DB code, and `migrations` stores SQL migrations. `apps/web`, `apps/extension`, and `packages/*` define the planned frontend, extension, and shared package boundaries.

## Build, Test, and Development Commands

From `services/api`:

```sh
make build        # build bin/api
make run          # run the API locally
make test         # run Go tests
make fmt          # go fmt ./...
make vet          # go vet ./...
make sqlc         # regenerate sqlc code
make tidy         # sync go.mod/go.sum
```

From the repository root:

```sh
cp .env.example .env
docker compose up -d --build
docker compose logs -f api
docker compose down
```

Set a real `AUTH_JWT_SECRET` in `.env` before starting the stack.

## Coding Style & Naming Conventions

Use `gofmt`; keep package names short and lowercase. Keep API internals under `services/api/internal`. HTTP handlers should stay thin: parse input, call a service, map known errors, and write through `internal/server/response` so successes use `data` and failures use `error`. Prefer sentinel errors plus `errors.Is` for expected failures. Wrap lower-level errors with context using `fmt.Errorf("area: action: %w", err)`. Repositories should hide `pgtype` conversion behind small helpers. Declare narrow interfaces at the consumer side when they are used for tests. Migrations use numbered names like `000016_use_review_rating_labels.up.sql`.

## Testing Guidelines

Go tests use the standard `testing` package and live beside code as `*_test.go`. Run `make test` before submitting API changes. For query or migration changes, also run `make sqlc`; commit generated files under `internal/storage/postgres/db`. Add focused tests for handlers, validation, scheduler behavior, and repository queries.

## Commit & Pull Request Guidelines

Use Conventional Commits:

```text
feat(api): add roadmap endpoint
fix(db): remove duplicate migration
docs(repo): add contributor guide
```

Common scopes are `api`, `web`, `extension`, `ui`, `shared`, `config`, and `repo`. Keep PRs narrow, link the related issue, describe what changed and how it was verified, and call out migrations, new environment variables, permissions, or breaking changes. Include screenshots or recordings for UI changes.

## Security & Configuration Tips

Never commit `.env`, secrets, tokens, or private keys. Caddy is the public reverse proxy; the API container should stay internal to the Compose network. Keep CORS changes explicit and test allowed and denied origins.
