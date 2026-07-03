# API

Go backend-сервис.

```text
cmd/api/       точка входа и сборка зависимостей
internal/      бизнес-логика, transport, storage и интеграции
migrations/    версионируемые миграции базы данных
```

## Локальный запуск

Для запуска на хосте нужен локальный `.env`; сервис загружает его при старте.

```sh
cp .env.example .env
go run ./cmd/api
```

Для запуска через Docker Compose используйте корневой `.env.example` как шаблон:

```sh
cp ../../.env.example ../../.env
docker compose -f ../../docker-compose.yml up -d --build
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/readyz
```

`AUTH_JWT_SECRET` обязателен и должен быть заменён на случайное значение перед запуском.
`FRP_VPS_HOST` и `FRP_TOKEN` для локального запуска не нужны.

## Go Task

Рядом с `Makefile` есть `Taskfile.yml` с теми же базовыми командами:

```sh
task test
task up
task prod-demo-up
task health
```

`task up` — обычный dev stack. `task prod-demo-up` — тот же stack плюс `frpc`
через compose profile `prod-demo`; для него нужны `FRP_VPS_HOST` и `FRP_TOKEN`.

## Runbooks

- [Prod-demo deploy runbook](../../docs/prod-demo-deploy-runbook.md)
