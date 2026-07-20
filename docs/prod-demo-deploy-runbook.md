# Prod-demo deploy runbook

Runbook для демо-окружения realgo: backend API, web, Caddy, Postgres, Redis и
reverse tunnel через `deploy/vps`.

## Схема

- Dev stack: корневой `docker-compose.yml` поднимает `api` (собственная
  сеть), `web`, `caddy`, `postgres`, `redis`, миграции и seed jobs — без VPS
  tunnel и без vpngw. Обычный `docker compose up` этого файла достаточно.
- Prod-demo: base + overlay `docker-compose.prod.yml` (vpngw; api переезжает
  в его network namespace; caddy монтирует `Caddyfile.internal.prod`) +
  профиль `prod-demo` для `frpc`.
- VPS edge: `deploy/vps/docker-compose.yml` поднимает `frps` и публичный Caddy.
- TLS завершается на VPS Caddy. Home Caddy получает plain HTTP через frp и
  роутит `/api/*` в api (`api:8080` в dev, `vpngw:8080` на сервере — см.
  `Caddyfile.internal.prod`), остальное в `web:3000`.

## Локальный dev запуск

```sh
cp .env.example .env
# заменить AUTH_JWT_SECRET на случайную строку 32+ символа
docker compose up -d --build
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/readyz
```

`FRP_VPS_HOST`, `FRP_TOKEN` и `VPN_SUB_URL` для dev-запуска не нужны.

Из backend-директории можно использовать Makefile или go-task:

```sh
cd services/api
make up
make logs

task up
task health
```

## Prod-demo env и secrets

Создать `.env` из `.env.example` на home stack:

```sh
cp .env.example .env
```

Обязательные значения для prod-demo:

| Key | Где | Требование |
| --- | --- | --- |
| `AUTH_JWT_SECRET` | home `.env` | Случайная строка минимум 32 символа; не placeholder. |
| `FRP_VPS_HOST` | home `.env` | Публичный IP или hostname VPS. |
| `FRP_TOKEN` | home `.env`, VPS `.env` | Один и тот же случайный shared token. |
| `VPN_SUB_URL` | home `.env` / secret | VLESS-подписка для vpngw; без неё overlay не отрезолвится и vpngw/api не стартуют. |

Прод-демо значения, которые обычно оставляем явно:

| Key | Где | Значение |
| --- | --- | --- |
| `REALGO_SITE_ADDRESS` | home/VPS `.env` | Домен демо, по умолчанию `realgo.dev`. |
| `REALGO_EXTENSION_ORIGIN` | home `.env` | Chrome extension origin из packaged extension. |
| `NEXT_PUBLIC_API_BASE_URL` | home `.env` | Пусто для same-origin `/api/*`. |
| `TRUSTED_PROXY_CIDRS` | home `.env` | CIDR trusted proxy, если включаем X-Forwarded-For trust. |
| `DB_PASSWORD` | home `.env` | Не оставлять dev default на публичном/общем демо. |
| `REDIS_PASSWORD` | home `.env` | Задать случайный пароль; compose применит его к Redis, API и healthcheck. |

Не коммитить `.env`, токены, приватные ключи расширения и server secrets.

## Deploy

VPS edge:

```sh
cd deploy/vps
printf 'FRP_TOKEN=<same-token-as-home>\n' > .env
docker compose up -d
docker compose ps
```

Home stack:

```sh
cp .env.example .env
# отредактировать AUTH_JWT_SECRET, FRP_VPS_HOST, FRP_TOKEN, DB_PASSWORD
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile prod-demo up -d --build
docker compose ps
```

Go Task альтернатива из backend-директории:

```sh
cd services/api
task prod-demo-up
task ps
```

## Healthcheck

Локально на home stack:

```sh
curl -fsS http://localhost:${API_PORT:-8080}/healthz
curl -fsS http://localhost:${API_PORT:-8080}/readyz
```

Через публичный домен:

```sh
curl -fsS https://realgo.dev/healthz
curl -fsS https://realgo.dev/readyz
# Auth-only проверка extension status (не public healthcheck):
curl -fsS -H "Authorization: Bearer $ACCESS_TOKEN" \
  https://realgo.dev/api/v1/me/extension/status
```

Expected:

- `/healthz` возвращает `{"status":"ok"}`.
- `/readyz` возвращает `{"status":"ready"}`.
- `docker compose ps` показывает `api`, `vpngw`, `web`, `caddy`, `frpc`,
  `postgres`, `redis` как running/healthy; `migrate` завершен успешно.

Если публичный healthcheck не проходит:

```sh
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile prod-demo logs -f caddy frpc api
cd deploy/vps && docker compose logs -f caddy frps
```

Проверить по порядку: DNS `REALGO_SITE_ADDRESS` указывает на VPS, `FRP_TOKEN`
совпадает на обеих сторонах, `FRP_VPS_HOST` доступен с home stack, `frpc`
зарегистрировал proxy `realgo-web`, `api` проходит `/readyz` локально.

## Smoke после деплоя

```sh
cd services/api
task migrate
task seed-roadmap
task seed-cards
task health
```

`seed-users` не входит в production smoke: prod overlay помещает его в
отдельный профиль `prod-demo-users`, потому что job сбрасывает данные demo
email. Запускать его только для одноразового/диспозабельного демо с явно
заданным `SEED_USERS_PASSWORD`:

```sh
SEED_USERS_PASSWORD='<strong-demo-password>' docker compose \
  -f docker-compose.yml -f docker-compose.prod.yml \
  --profile prod-demo-users run --rm seed-users
```

Затем пройти демо-сценарий из `DEMO.md`: login, extension event, dashboard,
review attempt, weak patterns.

## Rollback

Rollback приложения выполняется на заранее записанный release SHA, а не на
текущее состояние `main`:

```sh
git fetch --all --tags
git switch --detach "$RELEASE_SHA"
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile prod-demo up -d --build
curl -fsS http://localhost:${API_PORT:-8080}/readyz
```

Этот шаг не откатывает БД. Перед миграциями нужен backup/restore plan; если
новая миграция несовместима со старым бинарником, сначала восстановить БД из
проверенного backup либо применить отдельно подготовленную forward-fix
миграцию, и только затем переключать трафик.

Для VPS edge rollback обычно не нужен: edge stack не содержит app code. Если
менялись `deploy/vps/*`, вернуть предыдущую версию директории и выполнить
`docker compose up -d`.
