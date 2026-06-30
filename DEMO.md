# Engram — демо-окружение и сценарий

Сшивающий рунбук для локального демо MVP: поднять стек, создать пользователя,
прогнать сценарий **login → extension event → dashboard → review → weak
patterns** и проверить, что расширение не хранит HTML/condition/editorials.

Команды бэкенда/инфры — ссылки на уже существующие `make`-таргеты и
`docker-compose.yml` (этот файл их **не дублирует** и не меняет код сервисов).

---

## 0. Предусловия

- Docker + Docker Compose, Node 18+, Go 1.22+ (только если поднимаете API на хосте).
- Chrome (для load unpacked расширения).
- Порты на хосте свободны: `8080` (API через Caddy), `3000` (web), `5432` (PG), `6379` (Redis).

## 1. Поднять backend + БД + seed

```sh
# из корня репозитория
cp .env.example .env
# ОБЯЗАТЕЛЬНО: задать случайный AUTH_JWT_SECRET в .env (без него api не стартует)

cd services/api
make up            # docker compose up -d --build (postgres + redis + migrate + api + caddy)
make migrate       # применить миграции (000001..000013)
make seed-roadmap  # загрузить NeetCode 150 (seeds/neetcode_150.yaml)
```

**Expected:**
- `docker compose ps` — `postgres`, `redis`, `api`, `caddy` в состоянии `running`/`healthy`.
- `curl -s http://localhost:8080/healthz` → `200`.
- `make seed-roadmap` завершается без ошибок; в БД появились строки `problems`
  с `source_type = 'roadmap'`.

> Альтернатива на хосте (без Docker для самого api): `cd services/api && cp .env.example .env && go run ./cmd/api`.
> PG/Redis всё равно удобнее поднять из compose.

## 2. Создать demo-пользователя

Пресидженного юзера нет — регистрируем через API (или signup в web):

```sh
curl -s -X POST http://localhost:8080/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@engram.dev","password":"demo-pass-123"}'
```

**Expected:** `200` с envelope `{ "data": { "user": {...}, "tokens": {...} } }`.
Логин теми же кредами далее делаем **в расширении** (см. шаг 4).

## 3. Поднять web

```sh
cd apps/web
cp .env.example .env
npm install
npm run dev        # http://localhost:3000
```

**Expected:** открывается лендинг; кабинет — `http://localhost:3000/dashboard`.

> ⚠️ Известный гэп интеграции: в текущих ветках формы web и часть данных кабинета
> могут быть на моках (зона web). Реальные данные с API на dashboard появляются по
> мере wiring web↔API. Источник правды для шага «extension event» — БД (шаг 5/6).

## 4. Собрать и подключить расширение

```sh
cd apps/extension
npm install
npm run build      # plasmo build → build/chrome-mv3-prod
```

1. `chrome://extensions` → включить **Developer mode** → **Load unpacked** →
   выбрать `apps/extension/build/chrome-mv3-prod`.
2. Открыть **Options** расширения:
   - **API base URL** = `http://localhost:8080` → **OK** → **Проверить**.
     **Expected:** «Бэкенд на связи».
   - Ввести `demo@engram.dev` / `demo-pass-123` → **Войти**.
     **Expected:** «Расширение подключено к Engram», показан email.

## 5. Demo-сценарий (соответствует #30)

| Шаг | Действие | Expected result |
|---|---|---|
| 1. login | Шаг 4 выше | В options — подключённый аккаунт; `Authorization: Bearer` уходит на запросы. |
| 2. extension event | Открыть засиженную задачу, напр. `https://neetcode.io/problems/two-sum`, нажать **Submit**, в оверлее выбрать сложность → **Сохранить** | Состояние успеха («Запланировано»); ответ API `{ data: { accepted:true, duplicate:false, problemId, status, nextReviewAt } }`. |
| 2b. идемпотентность | Повторно отправить тот же сабмит (тот же `eventId`) | `duplicate: true`, дубль в БД **не создаётся** (см. шаг 6). |
| 3. dashboard | `http://localhost:3000/dashboard` | Решённая задача попадает в очередь повторений/метрики (при подключённом web↔API; иначе сверяемся через БД, шаг 6). |
| 4. review attempt | `/reviews` или `/cards/session` → выполнить повтор | Расписание FSRS продвигается (меняется `next_review_at`). |
| 5. weak patterns | Блок «слабые паттерны» на dashboard | Уверенность по паттерну отражает активность. |

## 6. Проверка: расширение НЕ хранит HTML/conditions/editorials

Гарантия структурная — в схеме нет колонок под HTML/описание/editorials.

```sh
# из корня (там docker-compose.yml)
docker compose exec postgres psql -U postgres -d freeburger -c "\d problems"
docker compose exec postgres psql -U postgres -d freeburger -c "\d extension_events"
docker compose exec postgres psql -U postgres -d freeburger \
  -c "SELECT id, event_type, external_slug, idempotency_key FROM extension_events ORDER BY id DESC LIMIT 3;"
docker compose exec postgres psql -U postgres -d freeburger \
  -c "SELECT raw_payload FROM extension_events ORDER BY id DESC LIMIT 1;"
```

**Expected:**
- `problems`: только `external_slug, title, url, difficulty, source_type, …` —
  никаких `html`/`description`/`conditions`/`editorial`.
- `extension_events`: `url, external_slug, title, event_type, rating,
  extension_version, event_time, idempotency_key, raw_payload` — без HTML.
- `idempotency_key` уникален (наш `eventId`); повтор того же сабмита не плодит строк.
- `raw_payload` — компактный JSON контракта (`eventId/source/event/occurredAt/rating/problem{externalId,title,url}`),
  **без** тела задачи, условий и разборов.

## 7. Свернуть окружение

```sh
cd services/api && make down   # docker compose down
```

---

### Контракт события расширения (для справки)

`POST /api/v1/extension/events` (`Authorization: Bearer <access_token>`):

```json
{
  "eventId": "<uuid, стабильный для одного сабмита>",
  "source": "neetcode",
  "event": "problem_solved",
  "occurredAt": "2026-06-30T08:45:00Z",
  "rating": "normal",
  "extensionVersion": "0.0.1",
  "problem": { "externalId": "two-sum", "title": "Two Sum", "url": "https://neetcode.io/problems/two-sum" }
}
```

Ответ: `{ "data": { "accepted", "duplicate", "problemId", "status", "nextReviewAt" } }`.
`canSolveAgain` на бэкенд не отправляется (в MVP не используется).
