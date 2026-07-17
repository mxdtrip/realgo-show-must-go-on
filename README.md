# FreeBurger (realgo)

Монорепозиторий продукта **realgo** — системы подготовки к техническим
интервью, которая не даёт решённым задачам забыться. Три приложения делят
один backend-контракт и одну инфраструктуру деплоя:

- **веб-приложение** (`apps/web`) — маркетинговый лендинг + личный кабинет;
- **браузерное расширение** (`apps/extension`) — ловит submit на площадках
  с задачами и кормит его в личный кабинет;
- **Go API** (`services/api`) — единый backend для обоих клиентов.

**Статус: активный demo-проект.** Публичная точка входа —
[realgo.dev](https://realgo.dev); её фактическую доступность проверяет runbook.
В репозитории есть CI (`ci.yml`), но автоматического deploy workflow сейчас нет.
Основной auth/cards/FSRS/extension/Atlas-контур реализован; генерация quiz,
экспорт данных и checkout пока являются явно обозначенными заготовками.

## Что решает продукт

Идея: *«Solved» ≠ «Remembered»*. Решённая задача без повторения забывается
почти всегда — обычно прямо перед интервью. realgo:

1. **Фиксирует** решение задачи прямо из браузера (расширение перехватывает
   submit на площадке, без ручного ввода).
2. **Планирует повторения** по алгоритму интервальных повторений (FSRS) —
   лёгкая задача уходит в очередь реже, тяжёлая — чаще.
3. **Строит персональный roadmap**: число недель считается из даты
   собеседования (не выбирается вручную), а темы — из реально релевантных
   выбранной компании субпаттернов Pattern Atlas (Company Overlay), а не из
   статичного учебного плана.
4. **Атлас паттернов**: 22 семейства / 111 субпаттернов алгоритмических
   паттернов с методическим материалом (что это, когда не подходит, с чем
   не путать), карточками повторения и AI-подсказками по требованию.
5. **AI-генерация карточек** по решённой задаче (кэш Redis → Postgres →
   провайдер, bounded queue и дедупликация). Quiz generation пока возвращает
   статус-заглушку и не должна считаться готовой функцией.

## Поддерживаемые площадки

Профиль пользователя (онбординг, `/settings`) и фильтр в Pattern Atlas
поддерживают 4 площадки: **LeetCode**, **HackerRank**, **GeeksforGeeks**,
**Codeforces**. Архитектура расширения — адаптеры по площадке
(`apps/extension/src/platforms`), поэтому список площадок расширяется без
переписывания расширения: **LeetCode** и **HackerRank** уже ловят submit и
кладут задачу в личный кабинет автоматически, GeeksforGeeks и Codeforces
подключены как площадки профиля и готовы принять адаптер следующими.

## Структура репозитория

```text
.
├── apps/
│   ├── web/                 # Next.js 16 (App Router), React 19, TypeScript, кастомный CSS
│   └── extension/           # Plasmo, TypeScript, Manifest V3
├── services/
│   └── api/                 # Go 1.25 API
│       ├── cmd/api/         # Точка входа бинарного приложения
│       ├── internal/        # Бизнес-логика: auth, cards, patterns, roadmap, ai, extension, ...
│       ├── migrations/      # Версионируемые SQL-миграции (golang-migrate)
│       └── seeds/           # Идемпотентные Python-сидеры контента и demo-данных
├── docs/                     # Контракт API, deploy runbook
└── packages/                 # Общий код для будущих клиентов (структура готова)
    ├── ui/                  # Общие React-компоненты
    ├── shared/              # Платформонезависимые TypeScript-типы/утилиты
    └── config/              # Общие настройки инструментов
```

### Backend: `services/api/internal`

Модульный монолит на chi + pgx + sqlc + Redis. Каждый пакет — отдельная
предметная область со своим handler/service/repository:

`ai` · `auth` · `cards` · `companies` · `dashboard` · `extension` ·
`patterns` (Pattern Atlas) · `practice` · `problemcards` · `problems` ·
`quiz` · `roadmap` / `roadmaps` · `scheduler` (FSRS) · `server` · `storage`
(sqlc-сгенерированный доступ к Postgres + Redis).

### Архитектурные границы

- `apps/*` — запускаемые frontend-приложения. Могут зависеть от `packages/*`,
  но не друг от друга.
- `services/*` — независимо собираемые Go-сервисы; код конкретного сервиса
  живёт в его `internal` и не импортируется извне.
- `packages/ui` — визуальные React-компоненты, добавляются только если
  реально используются обоими приложениями.
- `packages/shared` — типы/утилиты без React, Next.js и Plasmo API.
- `packages/config` — общие настройки инструментов без продуктового кода.

Node-приложения хранят собственные `package-lock.json`; общего Node
workspace в корне нет. Lock-файлы обязательны в Git.

## Быстрый запуск

`docker-compose.yml` — базовый (локальный) стек; всё серверное (vpngw, netns
для api, prod Caddyfile) вынесено в overlay `docker-compose.prod.yml`.
`VPN_SUB_URL`, `FRP_VPS_HOST`, `FRP_TOKEN` нужны только серверу.

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

То же из backend-директории (`make`/`go-task` — эквивалентны):

```sh
cd services/api
make up-api      # backend-only: API, Postgres, Redis, миграции, Caddy
make up          # то же + web
make health      # healthz + readyz
```

Если Docker пишет `permission denied` к сокету — это не ошибка проекта:
запустите Docker Desktop или добавьте пользователя в `docker` группу и
перелогиньтесь.

Prod-demo (сервер) запускается с overlay и профилем `prod-demo`:

```sh
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile prod-demo up -d --build
# или: cd services/api && make prod-demo-up
```

Для prod-demo нужны `FRP_VPS_HOST`, `FRP_TOKEN` и `VPN_SUB_URL`; для обычной
локальной разработки они не нужны. Полный разбор переменных окружения — в
[`.env.example`](.env.example); детали серверного деплоя — в
[prod-demo runbook](docs/prod-demo-deploy-runbook.md).

## Приложения и сервисы

- [Web](apps/web/README.md) — маршруты кабинета, PWA, локализация.
- [Browser Extension](apps/extension/README.md) — адаптеры площадок, авторизация, сборка/упаковка.
- [Go API](services/api/README.md) — запуск, Go Task, runbooks.

Полный контракт backend API (все `/me/*` эндпоинты, Pattern Atlas, practice
hub, AI-генерация карточек/квизов, assistant hints) — в
[docs/cabinet-api-contract.md](docs/cabinet-api-contract.md).

## CI/CD

`.github/workflows/ci.yml` настроен на каждый push в `main`/`dev` и каждый PR:
Go-сборка, `go vet`, unit/integration-тесты с Postgres/Redis, проверка generated
sqlc-кода, `golangci-lint` и `gofmt`; отдельно — TypeScript/build web и
extension, плюс Playwright e2e (`apps/web/e2e`). Перед релизом нужно проверить
зелёный run именно для выпускаемого SHA — наличие workflow-файла само по себе
не доказывает, что конкретный commit прошёл CI.

Repo-owned deploy workflow отсутствует. Prod-demo разворачивается вручную по
[runbook](docs/prod-demo-deploy-runbook.md); rollback и миграции требуют
операторского контроля. Назначение веток и правила pull request описаны в
[CONTRIBUTING.md](CONTRIBUTING.md).
