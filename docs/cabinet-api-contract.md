# realgo cabinet API contract

Документ описывает backend endpoint'ы, которые нужны web-личному кабинету realgo и браузерному расширению. Сейчас кабинет работает на моках, поэтому это целевой контракт для замены моков реальными данными.

## Базовые договорённости

- Base URL: `/api/v1`.
- Формат: JSON, `Content-Type: application/json; charset=utf-8`.
- Авторизация: `Authorization: Bearer <access_token>`.
- Время: ISO 8601 в UTC (`2026-06-30T09:30:00Z`).
- Даты без времени: `YYYY-MM-DD`.
- День пользователя считать в его timezone из профиля.
- Денежные/процентные значения передавать числами, отображение решает frontend.
- Все списки, которые могут расти, должны поддерживать `limit`, `cursor` и возвращать `nextCursor`.

## Общий формат ответа

Успешный ответ:

```json
{
  "data": {},
  "meta": {
    "requestId": "req_01J...",
    "serverTime": "2026-06-30T10:00:00Z"
  }
}
```

Ошибка:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Interview date must be a valid date",
    "details": {
      "field": "interviewDate"
    }
  },
  "meta": {
    "requestId": "req_01J..."
  }
}
```

Рекомендуемые коды ошибок:

- `UNAUTHORIZED`
- `FORBIDDEN`
- `NOT_FOUND`
- `VALIDATION_ERROR`
- `CONFLICT`
- `RATE_LIMITED`
- `INTERNAL_ERROR`

## MVP endpoint'ы

| Область | Endpoint | Назначение |
| --- | --- | --- |
| Auth | `POST /auth/register` | Создать пользователя |
| Auth | `POST /auth/login` | Войти |
| Profile | `GET /me` | Профиль и настройки кабинета |
| Profile | `PATCH /me/profile` | Обновить onboarding/profile |
| Companies | `GET /companies/search` | Подсказки компаний |
| Dashboard | `GET /me/dashboard` | Сводка главной страницы |
| Reviews | `GET /me/reviews/queue` | Очередь повторений |
| Reviews | `POST /me/reviews/{reviewId}/rate` | Оценить повторение |
| Problems | `GET /me/problems` | Список задач |
| Problems | `GET /me/problems/{problemId}` | Детали одной задачи |
| Problems | `POST /me/problems` | Сохранить задачу вручную или из extension |
| Cards | `GET /me/cards` | Список карточек |
| Cards | `GET /me/cards/session` | Очередь карточек для сессии |
| Cards | `POST /me/cards/{cardId}/rate` | Оценить карточку |
| Patterns | `GET /me/patterns` | Слабые/сильные паттерны |
| Roadmap | `GET /me/roadmap` | План подготовки |
| Extension | `POST /extension/events` | События из расширения |
| Extension | `GET /me/extension/status` | Статус синхронизации |
| Settings | `PATCH /me/notification-settings` | Настройки уведомлений |
| Privacy | `POST /me/export` | Экспорт прогресса |
| Privacy | `DELETE /me` | Удаление аккаунта |

## Auth

### `POST /auth/register`

Создаёт аккаунт. После регистрации frontend отправляет пользователя в onboarding.

Request:

```json
{
  "email": "user@example.com",
  "password": "strong-password",
  "locale": "ru",
  "timezone": "Europe/Moscow"
}
```

Response:

```json
{
  "data": {
    "user": {
      "id": "usr_01J...",
      "email": "user@example.com",
      "locale": "ru",
      "timezone": "Europe/Moscow",
      "onboardingStatus": "profile_required"
    },
    "tokens": {
      "access_token": "jwt",
      "refresh_token": "opaque_refresh_token",
      "token_type": "Bearer",
      "expires_in": 900
    }
  }
}
```

### `POST /auth/login`

Request:

```json
{
  "email": "user@example.com",
  "password": "strong-password"
}
```

Response аналогичен регистрации. Если onboarding не завершён, вернуть `onboardingStatus: "profile_required"`.

## Profile and onboarding

### `GET /me`

Нужен для topbar/sidebar, настроек и определения, нужно ли показывать onboarding.

Response:

```json
{
  "data": {
    "id": "usr_01J...",
    "email": "user@example.com",
    "displayName": "Backend SWE",
    "initials": "BS",
    "locale": "ru",
    "timezone": "Europe/Moscow",
    "plan": "free",
    "onboardingStatus": "completed",
    "targetCompany": {
      "id": "cmp_google",
      "name": "Google"
    },
    "interviewDate": "2026-07-21",
    "targetTopics": ["arrays", "two_pointers", "sliding_window"]
  }
}
```

Enums:

```text
plan: free | pro
onboardingStatus: profile_required | completed
```

### `PATCH /me/profile`

Обновляет данные из onboarding. Все поля optional: пользователь может пропустить любой вопрос.

Request:

```json
{
  "targetCompanyName": "Google",
  "interviewDate": "2026-07-21",
  "targetTopics": ["arrays", "two_pointers", "sliding_window"],
  "onboardingStatus": "completed"
}
```

Response:

```json
{
  "data": {
    "id": "usr_01J...",
    "targetCompany": {
      "id": "cmp_google",
      "name": "Google"
    },
    "interviewDate": "2026-07-21",
    "targetTopics": ["arrays", "two_pointers", "sliding_window"],
    "onboardingStatus": "completed"
  }
}
```

### `GET /companies/search?query=goo&limit=8`

Подсказки компаний для onboarding. Источник можно синхронизировать из `liquidslr/leetcode-company-wise-problems` или хранить свой справочник.

Response:

```json
{
  "data": [
    {
      "id": "cmp_google",
      "name": "Google",
      "source": "leetcode_company_wise"
    },
    {
      "id": "cmp_google_cloud",
      "name": "Google Cloud",
      "source": "manual"
    }
  ]
}
```

## Dashboard

### `GET /me/dashboard`

Сводка для `/dashboard`: метрики, ближайшее действие, короткая очередь и слабые паттерны.

Response:

```json
{
  "data": {
    "nextAction": {
      "type": "card_session",
      "title": "6 карточек на сегодня",
      "description": "Pattern recognition · 8 минут",
      "href": "/cards/session",
      "dueAt": "2026-06-30T09:30:00Z"
    },
    "stats": [
      {
        "key": "today_queue",
        "label": "today queue",
        "value": 12,
        "displayValue": "12",
        "hint": "8 задач, 3 карточки, 1 паттерн",
        "tone": "accent"
      },
      {
        "key": "readiness",
        "label": "readiness",
        "value": 68,
        "displayValue": "68%",
        "hint": "готовность к интервью",
        "tone": "success"
      }
    ],
    "reviewPreview": [
      {
        "id": "rev_01J...",
        "type": "problem_review",
        "title": "Longest Substring Without Repeating Characters",
        "meta": "Sliding Window · medium",
        "dueAt": "2026-06-30T09:30:00Z",
        "lastRating": "hard"
      }
    ],
    "weakPatterns": [
      {
        "id": "pat_sliding_window",
        "name": "Sliding Window",
        "confidence": 42,
        "signal": "3 hard reviews за неделю"
      }
    ]
  }
}
```

Enums:

```text
nextAction.type: card_session | problem_review | pattern_review | roadmap_step
tone: default | accent | success | warning | danger
rating: hard | normal | easy
```

## Reviews

### `GET /me/reviews/queue?status=due&limit=50&cursor=...`

Очередь повторений для `/reviews` и виджетов dashboard. В одну очередь попадают задачи, карточки и паттерны.

Response:

```json
{
  "data": [
    {
      "id": "rev_01J...",
      "entityType": "problem",
      "entityId": "prb_01J...",
      "title": "Valid Parentheses",
      "meta": "Stack · easy",
      "typeLabel": "problem review",
      "dueAt": "2026-06-30T18:30:00Z",
      "status": "due",
      "lastRating": "easy",
      "attempts": 3
    }
  ],
  "meta": {
    "nextCursor": null
  }
}
```

Enums:

```text
entityType: problem | card | pattern
status: due | upcoming | completed | skipped
```

### `POST /me/reviews/{reviewId}/rate`

Оценка общего элемента очереди.

Request:

```json
{
  "rating": "normal",
  "reviewedAt": "2026-06-30T10:15:00Z"
}
```

Response:

```json
{
  "data": {
    "reviewId": "rev_01J...",
    "rating": "normal",
    "nextReviewAt": "2026-07-03T09:00:00Z",
    "status": "completed"
  }
}
```

Правило MVP scheduling:

- `hard` — вернуть сегодня в очередь или на следующий короткий интервал.
- `normal` — через 3 дня.
- `easy` — через 7 дней.

Точные интервалы должны быть backend-конфигурацией, чтобы frontend только отображал `nextReviewAt`.

## Problems

### `GET /me/problems?status=reviewing&platform=leetcode&limit=50&cursor=...`

Response:

```json
{
  "data": [
    {
      "id": "prb_01J...",
      "externalId": "leetcode_two_sum_ii",
      "title": "Two Sum II",
      "url": "https://leetcode.com/problems/two-sum-ii/",
      "platform": "leetcode",
      "difficulty": "medium",
      "pattern": {
        "id": "pat_two_pointers",
        "name": "Two Pointers"
      },
      "status": "reviewing",
      "nextReviewAt": "2026-07-01T09:00:00Z",
      "lastRating": "normal",
      "solvedAt": "2026-06-28T20:10:00Z",
      "createdAt": "2026-06-28T20:10:00Z",
      "updatedAt": "2026-06-30T09:00:00Z"
    }
  ],
  "meta": {
    "nextCursor": null
  }
}
```

Enums:

```text
platform: leetcode | neetcode | codeforces | custom
difficulty: easy | medium | hard | unknown
status: saved | reviewing | mastered | archived
```

### `GET /me/problems/{problemId}`

Детали одной задачи. Поля идентичны list-item (тот же camelCase контракт) плюс
`note` — пользовательская заметка, отсутствующая в list. `hintsUsed` показывает,
сколько успешных подсказок ассистента выдано по этой задаче.

Response:

```json
{
  "data": {
    "id": 42,
    "externalId": "leetcode_two_sum_ii",
    "title": "Two Sum II",
    "url": "https://leetcode.com/problems/two-sum-ii/",
    "platform": "leetcode",
    "difficulty": "medium",
    "pattern": {
      "id": "two_pointers",
      "name": "Two Pointers"
    },
    "status": "reviewing",
    "nextReviewAt": "2026-07-01T09:00:00Z",
    "lastRating": "normal",
    "solvedAt": "2026-06-28T20:10:00Z",
    "hintsUsed": 3,
    "note": "не забыть edge case с пустым массивом",
    "createdAt": "2026-06-28T20:10:00Z",
    "updatedAt": "2026-06-30T09:00:00Z"
  },
  "meta": {
    "requestId": "..."
  }
}
```

Ошибки: `404 NOT_FOUND` (задача не найдена или не принадлежит пользователю),
`400 VALIDATION_ERROR` (нечисловой `problemId`), `401 UNAUTHORIZED` (без токена).

### `POST /me/problems`

Используется ручным добавлением и расширением.

Request:

```json
{
  "title": "Two Sum II",
  "url": "https://leetcode.com/problems/two-sum-ii/",
  "platform": "leetcode",
  "difficulty": "medium",
  "patternName": "Two Pointers",
  "solvedAt": "2026-06-28T20:10:00Z",
  "source": "extension"
}
```

Response:

```json
{
  "data": {
    "id": "prb_01J...",
    "status": "reviewing",
    "nextReviewAt": "2026-07-01T09:00:00Z"
  }
}
```

### `GET /me/problems/{problemId}/cards`

Contract fixed 2026-07-05 (coordinator @mxdtrip) so the web AI-card badge and
generation-status UI (#228) can build against it before the backend cards
land. Auth: Bearer, as for the rest of `/me/*`.

Response:

```json
{
  "data": {
    "status": "ready",
    "cards": [
      {
        "id": "card_01J...",
        "type": "pattern_recognition",
        "source": {
          "entityType": "problem",
          "entityId": "prb_01J...",
          "label": "Two Sum II · Two Pointers"
        },
        "front": "Дан отсортированный массив и target. Какой подход выбрать?",
        "back": "Two Pointers: двигаем left/right внутрь по сравнению суммы с target.",
        "status": "new",
        "nextReviewAt": null,
        "lastRating": null,
        "createdByAi": true,
        "createdAt": "2026-07-05T10:00:00Z"
      }
    ]
  }
}
```

`status`:

```text
ready      - the user has accessible cards for the problem: global seed/AI
             cards (filtered by the user's progress, see #226) or their own.
             cards is the same shape as GET /me/cards, non-empty.
generating - no cards yet, but AI generation is in flight
             (Redis lock lock:gen:{platform}:{slug} held). cards: [].
none       - no cards and no generation in flight. Also covers a model
             unknown_problem refusal and exhausted AI quota. cards: [].
```

404 when `problemId` does not exist.

Client polling: every 2-3s until `status` is `ready` or `none`, capped at
~60s; treat a still-`generating` result past the cap as `none`.

## Cards

### `GET /me/cards?type=pattern_recognition&limit=50&cursor=...`

Список карточек для страницы `/cards`.

Response:

```json
{
  "data": [
    {
      "id": "card_01J...",
      "type": "pattern_recognition",
      "source": {
        "entityType": "problem",
        "entityId": "prb_01J...",
        "label": "Two Sum II · Two Pointers"
      },
      "front": "Дан отсортированный массив и target. Какой подход выбрать?",
      "back": "Two Pointers: двигаем left/right внутрь по сравнению суммы с target.",
      "status": "due",
      "nextReviewAt": "2026-06-30T09:30:00Z",
      "lastRating": "normal",
      "createdByAi": false,
      "createdAt": "2026-06-28T20:10:00Z"
    }
  ],
  "meta": {
    "nextCursor": null
  }
}
```

Enums:

```text
card.type: pattern_recognition | algorithm_mechanics | edge_case
card.status: new | due | learning | mastered | archived
```

### `GET /me/cards/session?scope=due&limit=20`

Возвращает минимальный набор для фокусной сессии карточек. Frontend показывает только этот payload, без дополнительных запросов между карточками.

Response:

```json
{
  "data": {
    "sessionId": "crs_01J...",
    "scope": "due",
    "estimatedMinutes": 8,
    "cards": [
      {
        "id": "card_01J...",
        "type": "pattern_recognition",
        "sourceLabel": "Two Sum II · Two Pointers",
        "front": "Дан отсортированный массив и target. Какой подход выбрать?",
        "back": "Two Pointers: двигаем left/right внутрь по сравнению суммы с target.",
        "createdByAi": false,
        "reviewState": {
          "attempts": 2,
          "lastRating": "normal",
          "nextReviewAt": "2026-06-30T09:30:00Z"
        }
      }
    ]
  }
}
```

`scope`:

```text
due: карточки, срок которых наступил
hard_normal: перепройти карточки с последними rating hard или normal
all: полный тренировочный прогон
```

### `POST /me/cards/{cardId}/rate`

Request:

```json
{
  "sessionId": "crs_01J...",
  "rating": "hard",
  "reviewedAt": "2026-06-30T10:20:00Z"
}
```

Response:

```json
{
  "data": {
    "cardId": "card_01J...",
    "rating": "hard",
    "nextReviewAt": "2026-06-30T10:35:00Z",
    "repeatInCurrentSession": true,
    "sessionProgress": {
      "reviewed": 2,
      "total": 6,
      "remaining": 5
    }
  }
}
```

Для текущего UX важно поле `repeatInCurrentSession`: если `true`, frontend может вернуть карточку в конец локальной очереди.

## Patterns

### `GET /me/patterns?sort=weakness`

Response:

```json
{
  "data": [
    {
      "id": "pat_dynamic_programming",
      "name": "Dynamic Programming",
      "confidence": 37,
      "priority": "high",
      "signal": "нужны карточки по состояниям",
      "stats": {
        "solvedProblems": 4,
        "hardReviewsLast7Days": 3,
        "dueReviews": 2
      }
    }
  ]
}
```

Enums:

```text
priority: low | medium | high
```

## Roadmap

### `GET /me/roadmap`

Response:

```json
{
  "data": {
    "overallProgress": 49,
    "target": {
      "company": "Google",
      "interviewDate": "2026-07-21"
    },
    "weeks": [
      {
        "id": "week_01",
        "label": "week 01",
        "title": "Arrays, Hashing, Two Pointers",
        "progress": 82,
        "focus": "собрать базу и закрыть быстрые повторения",
        "status": "done",
        "topics": ["arrays", "hashing", "two_pointers"]
      }
    ]
  }
}
```

Enums:

```text
roadmap.status: todo | active | done
```

## Browser extension integration

### `POST /extension/events`

Расширение отправляет событие после submit'а задачи и пользовательской оценки. Backend идемпотентен по ключу, который строится из пользователя, задачи, времени submit'а и оценки.

Request:

```json
{
  "platform": "leetcode",
  "taskTitle": "Valid Parentheses",
  "taskUrl": "https://leetcode.com/problems/valid-parentheses/",
  "platformTaskSlug": "valid-parentheses",
  "submitResult": "accepted",
  "submittedAt": "2026-06-30T08:45:00Z",
  "userDifficulty": "normal",
  "canSolveAgain": "probably"
}
```

Response:

```json
{
  "data": {
    "accepted": true,
    "duplicate": false,
    "problemId": 123,
    "status": "reviewing",
    "nextReviewAt": "2026-07-03T08:45:00Z"
  }
}
```

Enums:

```text
platform: leetcode | neetcode | unknown
submitResult: accepted | wrong_answer | runtime_error | time_limit | unknown
userDifficulty: hard | normal | easy
canSolveAgain: no | probably | yes
```

### `GET /me/extension/status`

Response:

```json
{
  "data": {
    "connected": true,
    "platforms": [
      {
        "source": "leetcode",
        "status": "connected",
        "lastSyncAt": "2026-06-30T08:45:00Z"
      }
    ],
    "recentEvents": [
      {
        "id": "evt_01J...",
        "source": "leetcode",
        "event": "problem_solved",
        "title": "Two Sum II",
        "occurredAt": "2026-06-30T08:45:00Z"
      }
    ]
  }
}
```

## Settings and notifications

### `GET /me/notification-settings`

Response:

```json
{
  "data": {
    "enabled": true,
    "dailyReminder": true,
    "cardReviewReminder": true,
    "streakReminder": false,
    "reminderTime": "09:00",
    "timezone": "Europe/Moscow",
    "pushSubscriptionStatus": "active"
  }
}
```

### `PATCH /me/notification-settings`

Request:

```json
{
  "enabled": true,
  "dailyReminder": true,
  "cardReviewReminder": true,
  "streakReminder": false,
  "reminderTime": "09:00"
}
```

Response возвращает актуальные настройки.

### `POST /me/push-subscriptions`

Понадобится, когда PWA-уведомления станут серверными push, а не локальными browser notifications.

Request:

```json
{
  "endpoint": "https://push.service/...",
  "keys": {
    "p256dh": "base64",
    "auth": "base64"
  },
  "userAgent": "Mozilla/5.0 ..."
}
```

## Privacy

### `POST /me/export`

Запускает экспорт данных пользователя.

Response:

```json
{
  "data": {
    "exportId": "exp_01J...",
    "status": "pending"
  }
}
```

### `GET /me/export/{exportId}`

Response:

```json
{
  "data": {
    "exportId": "exp_01J...",
    "status": "ready",
    "downloadUrl": "https://...",
    "expiresAt": "2026-07-01T10:00:00Z"
  }
}
```

### `DELETE /me`

Request:

```json
{
  "confirm": "DELETE"
}
```

Response:

```json
{
  "data": {
    "deleted": true,
    "deletedAt": "2026-06-30T10:00:00Z"
  }
}
```

## Shared dictionaries

Frontend ожидает стабильные идентификаторы, а не только display labels:

```text
topics: arrays, hashing, two_pointers, sliding_window, stack, binary_search,
        linked_list, trees, graphs, heap, backtracking, dynamic_programming,
        greedy, intervals, tries, bit_manipulation

ratings: hard, normal, easy

card types: pattern_recognition, algorithm_mechanics, edge_case

review entity types: problem, card, pattern
```

Display labels можно отдавать с backend или хранить на frontend, но API должен всегда возвращать стабильный `id`.

## Что можно отложить после MVP

- AI-генерация карточек.
- Полная персонализация roadmap под конкретную компанию.
- Серверные push notifications.
- Экспорт в Anki.
- Billing/Pro.
- Командные/менторские функции.

## Открытые вопросы для backend

1. Где хранится справочник компаний: своя таблица, периодический import из GitHub или live-proxy?
2. Кто является источником истины для расписания повторений: backend полностью или frontend может локально переупорядочивать текущую сессию?
3. Нужна ли поддержка нескольких активных целей подготовки у одного пользователя?
4. Нужно ли сохранять черновики карточных сессий между устройствами?
5. Какие платформы расширения поддерживаем в MVP: только LeetCode или также NeetCode/custom?
