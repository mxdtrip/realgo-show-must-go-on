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
```

`AUTH_JWT_SECRET` обязателен и должен быть заменён на случайное значение перед запуском.
