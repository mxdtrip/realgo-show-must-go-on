# FreeBurger

Монорепозиторий backend-сервисов, веб-приложения и браузерного расширения.

## Структура

```text
.
├── apps/
│   ├── web/                 # Next.js, React, TypeScript, кастомный CSS
│   └── extension/           # Plasmo, TypeScript, Manifest V3
├── services/
│   └── api/                 # Go API
│       ├── cmd/api/         # Точка входа бинарного приложения
│       ├── internal/        # Закрытая бизнес-логика и адаптеры
│       └── migrations/      # Миграции базы данных
└── packages/
    ├── ui/                  # Зарезервировано под общие React-компоненты
    ├── shared/              # Зарезервировано под общие TypeScript-типы
    └── config/              # Зарезервировано под общие настройки инструментов
```

## Архитектурные границы

- `apps/*` — запускаемые frontend-приложения. Они могут зависеть от `packages/*`, но не друг от друга.
- `services/*` — независимо собираемые Go-сервисы. Код конкретного сервиса находится в его `internal`.
- `packages/ui` — визуальные React-компоненты. Компоненты shadcn/ui добавляются сюда только если действительно используются обоими приложениями; специфичные компоненты остаются внутри приложения.
- `packages/shared` — платформонезависимые TypeScript-типы, схемы и утилиты без React, Next.js и Plasmo API.
- `packages/config` — единые настройки инструментов без продуктового кода.

Node-приложения пока хранят собственные `package-lock.json`; общего Node workspace в корне нет. Lock-файлы package manager должны храниться в Git.

## Быстрый запуск

Локальный dev stack не требует VPS/FRP-переменных:

```sh
cp .env.example .env
# заменить AUTH_JWT_SECRET на случайную строку 32+ символа
docker compose up -d --build
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/readyz
```

То же из backend-директории:

```sh
cd services/api
make up-api
# или go-task:
task up-api
task health
```

`make up-api` / `task up-api` поднимают только backend, БД, Redis, миграции и
Caddy. Полный стек с web: `make up` / `task up`.

Если Docker пишет `permission denied` к сокету, это не ошибка проекта: запустите
Docker Desktop или добавьте пользователя в docker group и перелогиньтесь.

Prod-demo с reverse tunnel запускается отдельным profile:

```sh
docker compose --profile prod-demo up -d --build
```

Для prod-demo нужны `FRP_VPS_HOST` и `FRP_TOKEN`; для обычной локальной разработки
они не нужны. Детали: [prod-demo runbook](docs/prod-demo-deploy-runbook.md).

## Приложения и сервисы

- [Web](apps/web/README.md)
- [Browser Extension](apps/extension/README.md)
- [Go API](services/api/README.md)

Правила создания веток, коммитов и pull request описаны в [CONTRIBUTING.md](CONTRIBUTING.md).
