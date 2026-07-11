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

`docker-compose.yml` — базовый (локальный) стек; всё серверное (vpngw, netns
для api, prod Caddyfile) вынесено в overlay `docker-compose.prod.yml`.
`VPN_SUB_URL`, `FRP_VPS_HOST`, `FRP_TOKEN` нужны только серверу.

Локальный dev stack:

```sh
cp .env.example .env
# заменить AUTH_JWT_SECRET на случайную строку 32+ символа
docker compose up -d --build
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/readyz
```

Сайт и API доступны через Caddy на `http://localhost:8080` (порт меняется
переменной `API_PORT`). Порт 3000 наружу не публикуется: web-контейнер виден
только внутри docker-сети, Caddy проксирует на него всё, кроме `/api/*`.

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

Prod-demo (сервер) запускается с overlay и профилем `prod-demo`:

```sh
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile prod-demo up -d --build
# или: cd services/api && make prod-demo-up / task prod-demo-up
```

Для prod-demo нужны `FRP_VPS_HOST`, `FRP_TOKEN` и `VPN_SUB_URL`; для обычной
локальной разработки они не нужны. Детали:
[prod-demo runbook](docs/prod-demo-deploy-runbook.md).

## Приложения и сервисы

- [Web](apps/web/README.md)
- [Browser Extension](apps/extension/README.md)
- [Go API](services/api/README.md)

Продукт: система подготовки к собеседованиям (realgo) — личный кабинет, Pattern Atlas
(22 семейства / 111 субпаттернов с Company Overlay), карточки повторения с AI-генерацией,
квизы, AI-подсказки ассистента и браузерное расширение, которое ловит submit на HackerRank и
кладёт задачу в персональную систему повторений. Полный контракт backend API — в
[docs/cabinet-api-contract.md](docs/cabinet-api-contract.md).

Правила создания веток, коммитов и pull request описаны в [CONTRIBUTING.md](CONTRIBUTING.md).
