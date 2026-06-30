# API Seeds

В этой папке лежат версионируемые manifest-файлы с данными и маленькие
one-shot скрипты, которые загружают эти данные в Postgres.

## NeetCode 150 Roadmap

`neetcode_150.yaml` - источник правды для seed-а NeetCode 150 roadmap.
Приложение после загрузки seed-а должно читать roadmap из Postgres, а не из
этого YAML в runtime.

Запуск через compose:

```sh
make seed-roadmap
```

Или напрямую, если Postgres доступен с хоста:

```sh
cd services/api/seeds
python -m pip install -r requirements.txt
DATABASE_URL='postgres://postgres:postgres@localhost:5432/freeburger?sslmode=disable' \
  python seed_roadmap.py neetcode_150.yaml
```

## Формат Manifest

У каждого roadmap есть метаданные и упорядоченные секции. Каждая секция
мапится в строку `patterns`, каждая задача - в строку `problems`.

```yaml
code: neetcode_150
title: NeetCode 150
source_url: https://neetcode.io/practice/practice/neetcode150
captured_at: 2026-06-28
sections:
  - pattern:
      code: arrays_hashing
      name: Arrays & Hashing
    problems:
      - slug: contains-duplicate
        external_id: "217"
        title: Contains Duplicate
        difficulty: easy
        url: https://leetcode.com/problems/contains-duplicate/
```

`external_id` - номер задачи на внешней платформе. Для LeetCode это число из
ссылок и списков, например `128` для `Longest Consecutive Sequence`.
`difficulty` должен быть одним из `easy`, `medium`, `hard`. Значения `slug`
должны быть уникальны внутри одного manifest-а.

## Как Это Ложится В БД

Seed идемпотентный: повторный запуск не создаёт дубликаты.

Он делает upsert:

- `patterns` по `code`
- `problems` по `(platform_id, external_slug)` с `source_type = 'roadmap'`
- `roadmap_items` для `code` из manifest-а

`roadmap_items` сохраняет саму идею roadmap:

```text
roadmap_code -> problem_id -> pattern_id -> position
```

Для `neetcode_150` это 150 упорядоченных строк с позициями `1..150`.

Seed не удаляет задачи из `problems`. Он только заменяет строки
`roadmap_items` для roadmap-а, который сейчас загружается.

## Пример Запроса Через pgx

Так можно получить задачи roadmap в правильном порядке:

```go
type RoadmapProblem struct {
	Position   int
	Pattern    string
	ExternalID string
	Slug       string
	Title      string
	URL        string
	Difficulty string
}

func ListRoadmapProblems(ctx context.Context, pool *pgxpool.Pool, roadmapCode string) ([]RoadmapProblem, error) {
	rows, err := pool.Query(ctx, `
		SELECT
			ri.position,
			pt.name,
			p.external_id,
			p.external_slug,
			p.title,
			p.url,
			p.difficulty
		FROM roadmap_items ri
		JOIN patterns pt ON pt.id = ri.pattern_id
		JOIN problems p ON p.id = ri.problem_id
		WHERE ri.roadmap_code = $1
		ORDER BY ri.position
	`, roadmapCode)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var problems []RoadmapProblem
	for rows.Next() {
		var problem RoadmapProblem
		if err := rows.Scan(
			&problem.Position,
			&problem.Pattern,
			&problem.ExternalID,
			&problem.Slug,
			&problem.Title,
			&problem.URL,
			&problem.Difficulty,
		); err != nil {
			return nil, err
		}
		problems = append(problems, problem)
	}
	return problems, rows.Err()
}
```

Для дорожной карты NeetCode 150 передавай `roadmapCode = "neetcode_150"`.

## Demo Users

`seed_users.py` создаёт предсозданные аккаунты для ручного тестирования и
кладёт им прогресс, due review schedules, review attempts и extension events
по задачам из `neetcode_150`. Перед ним должен быть загружен roadmap seed.

Запуск через compose:

```sh
make seed-users
```

Сброс демо-аккаунтов к исходному состоянию:

```sh
make reset-demo
```

Или напрямую:

```sh
cd services/api/seeds
python -m pip install -r requirements.txt
DATABASE_URL='postgres://postgres:postgres@localhost:5432/freeburger?sslmode=disable' \
  python seed_users.py
```

Аккаунты для тестера:

| Email | Password | Назначение |
| --- | --- | --- |
| `tester@example.test` | `Password123!` | free-пользователь с несколькими статусами задач |
| `pro@example.test` | `Password123!` | pro-пользователь с короткой историей прогресса |
| `admin@example.test` | `Password123!` | тестовый admin-профиль через `plan = admin` |

Важно: в текущей схеме нет отдельной роли или прав администратора. `admin`
сейчас только значение `users.plan`, чтобы тестер мог отличить аккаунт.

Seed идемпотентный: повторный запуск обновляет аккаунты, чистит
`user_problem_progress`, `review_schedules`, `review_attempts` и
`extension_events` только для demo-аккаунтов, затем заново кладёт исходное
demo-состояние.
