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

## HackerRank Interview Corpus

`atlas_hackerrank_problems.yaml` - официальный interview-корпус HackerRank
(Classic + 1 Week + 1 Month + 3 Months Preparation Kits): 150 уникальных
slug-ов, memberships наборов в `collections`, статусы `mapped` /
`gap_candidate` / `non_pattern`. Линкуются на подпаттерны только `mapped`
записи (131); HRX-* gap-кандидаты и implementation-задачи ждут
cross-platform review и в атлас не попадают (force-mapping запрещён).

```sh
DATABASE_URL='postgres://postgres:postgres@localhost:5432/freeburger?sslmode=disable' \
  python seed_hackerrank_corpus.py atlas_hackerrank_problems.yaml
```

Идемпотентен: задачи апсертятся по `(platform_id, external_slug)`, curated
линки (`tier IS NOT NULL`) никогда не перетираются.

## GeeksforGeeks Corpus

`atlas_gfg_problems.yaml` — 78 задач practice.geeksforgeeks.org по 21
подпаттерну (приоритет — темы, тонко/не покрытые LeetCode+HackerRank на
момент сбора 2026-07-21). Собран ChatGPT deep-research проходом с реальным
браузингом; каждый slug/title сверен вручную с живой страницей перед
мёржем — 4/4 выборочных проверки совпали дословно. Как и LeetCode-корпус,
tier = NULL (не curated); только primary-линк на подпаттерн, без company
tags и без роадмапа.

```sh
DATABASE_URL='postgres://postgres:postgres@localhost:5432/freeburger?sslmode=disable' \
  python seed_gfg_corpus.py atlas_gfg_problems.yaml
```

Идемпотентен, та же схема апсерта, что у `seed_atlas_corpus.py`.

## Codeforces Corpus

`atlas_codeforces_problems.yaml` — 83 задачи по 21 подпаттерну, с явным tier
(`foundational`/`core`/`advanced` по rating-диапазону 800-1200/1300-1700/1800+).
В отличие от остальных корпусов, этот **curated с самого начала**: каждая
строка проверена против официального Codeforces API
(`codeforces.com/api/problemset.problems`) — 83/83 совпадений по title и
rating, 0 придуманных тегов. Поэтому tier у него не NULL и всегда
перезаписывается при повторном сиде (как `atlas_problem_links.yaml`), а не
защищается от перетирания как в plain-корпусах. `external_slug` — это
`{contestId}{index}` (например `"427C"`), у Codeforces нет числового
external_id, общего с другими площадками.

```sh
DATABASE_URL='postgres://postgres:postgres@localhost:5432/freeburger?sslmode=disable' \
  python seed_codeforces_corpus.py atlas_codeforces_problems.yaml
```

## Company Problems Dataset

`atlas_company_problems.csv.gz` — реальные company↔problem улики из публичных
company-wise репозиториев (liquidslr, snehasishroy, krishnadey30, hxu296;
338 компаний, ~21k пар, source_type=dataset). `evidence_count` = число
независимых источников, `last_seen` — оценка свежести из recency-бакетов.
Пересборка из свежих клонов источников: `build_company_problems.py --help`.

```sh
DATABASE_URL='postgres://postgres:postgres@localhost:5432/freeburger?sslmode=disable' \
  python seed_company_problems.py atlas_company_problems.csv.gz
```

Сидер идемпотентен (dataset-слой пересобирается целиком) и сам выводит
relevance подпаттернов для Company Overlay из линков problem_subpatterns —
руками relevance в датасете не назначается. Demo-строки при коллизии
вытесняются dataset'ом, manual/community не трогаются. Запускать ПОСЛЕ
seed_atlas.py и seed_atlas_corpus.py (нужны линки задач на подпаттерны).

## GFG Company Problems Dataset

`atlas_gfg_company_problems.csv.gz` — company↔problem улики с публичного GFG
company-tags API (158 компаний / 1183 уникальных задачи / 3567 пар,
собрано 2026-07-21, полный отчёт и SHA-256 в архиве коллектора). В отличие
от LeetCode-датасета evidence_count всегда 1 (один источник — сам GFG),
`difficulty` пустая у 186 строк (GFG-значение `Basic` вне словаря
easy/medium/hard). `problem_url` в CSV уже полный (не собирается из slug,
как для LeetCode).

Company-коды в CSV НЕ доверяются напрямую: `seed_gfg_company_problems.py`
пересчитывает `cmp_<key>` из display-имени той же нормализацией, что и
`build_company_problems.py` (LeetCode), — иначе Amazon/Adobe/… с GFG легли
бы отдельной строкой в `companies` и раздвоили evidence вместо слияния с
LeetCode-версией той же компании. 59 из 158 компаний пересекаются с
LeetCode-датасетом по этому ключу.

```sh
DATABASE_URL='postgres://postgres:postgres@localhost:5432/freeburger?sslmode=disable' \
  python seed_gfg_company_problems.py atlas_gfg_company_problems.csv.gz
```

Идемпотентен, та же схема ребилда, что у `seed_company_problems.py` — но
`DELETE FROM company_problems` в обоих скриптах скоупится по platform_id
(добавлено заодно в `seed_company_problems.py`), поэтому два сидера можно
гонять в любом порядке, не затирая evidence друг друга. Ребилд
`subpattern_companies`, наоборот, намеренно НЕ скоупится по платформе —
relevance подпаттерна для компании складывается из dataset-evidence со всех
платформ сразу. Запускать ПОСЛЕ seed_atlas.py/seed_atlas_corpus.py (нужны
линки задач на подпаттерны); порядок относительно `seed_company_problems.py`
не важен по тем же причинам.

## realgo Demo Cards

`realgo_demo_cards.yaml` - демо-набор Anki-style карточек для задач и
паттернов из `neetcode_150`. Ответы короткие, без кода, на русском с
английскими терминами из интервью-практики.

Перед загрузкой карточек должен быть загружен roadmap seed, потому что
карточки резолвят `problem_slug` и `pattern_code` в реальные `problems` и
`patterns`.

Запуск через compose:

```sh
make seed-roadmap
make seed-cards
```

Или напрямую:

```sh
cd services/api/seeds
python -m pip install -r requirements.txt
DATABASE_URL='postgres://postgres:postgres@localhost:5432/freeburger?sslmode=disable' \
  python seed_cards.py realgo_demo_cards.yaml
```

Локальная проверка YAML без подключения к Postgres:

```sh
cd services/api/seeds
python seed_cards.py realgo_demo_cards.yaml --validate-only
```

Формат карточек:

```yaml
code: realgo_demo_cards
title: realgo Demo Cards
cards:
  - key: two-sum-complement
    type: pattern_recognition
    problem_slug: two-sum
    question: "Two Sum: почему complement lookup лучше полного перебора?"
    answer: "Для каждого числа достаточно проверить, видели ли мы target minus current."
```

У карточки должен быть ровно один target:

- `problem_slug` - задача из `neetcode_150.yaml`
- `pattern_code` - паттерн из `neetcode_150.yaml`

`type` должен быть одним из значений контракта Cards:
`pattern_recognition`, `algorithm_mechanics`, `edge_case`.

Seed идемпотентный: существующие глобальные карточки обновляются на месте по
стабильному `source`, новые вставляются, а удаляются только карточки, исчезнувшие
из manifest. Поэтому повторный запуск сохраняет card ID и review history. Если
база ещё содержит legacy constraint `cards.card_type_target_check` со старыми типами
`problem|pattern|concept`, загрузчик остановится с понятной ошибкой: этот
constraint должен быть исправлен миграцией вне seed-скриптов.

## Realgo Subpattern Practice Cards

`realgo_subpattern_cards.yaml` - 333 карточки (по 3 на каждый из 111
subpattern-узлов realgo-v2: `pattern_recognition`, `algorithm_mechanics`,
`edge_case`). В отличие от `realgo_demo_cards.yaml`/`pattern_cards.yaml`,
здесь `pattern_code` всегда указывает на **subpattern**, а не на
family/pattern-код - это то, что делает добавление подпаттерна в практику
(`POST /me/practice/subpatterns`) осмысленным: `practice.Repository.Add`
сразу ставит эти 3 карточки в `review_schedules` пользователя (см.
`EnqueueCardsForPatternIfAbsent` в `queries/cards.sql`), а не ждёт первой
ручной оценки одной карточки.

Не требует roadmap seed: subpattern-коды (`kind = 'subpattern'`) заводятся
самими миграциями (`migrations/000015_taxonomy_v2.up.sql`), поэтому seed
достаточно, чтобы прошли миграции. `--roadmap ''` отключает офлайн-сверку
`pattern_code` со списком паттернов `neetcode_150.yaml`, потому что
subpattern-коды туда не входят.

Запуск через compose:

```sh
docker compose run --rm seed-subpattern-cards
```

Или напрямую:

```sh
cd services/api/seeds
python -m pip install -r requirements.txt
DATABASE_URL='postgres://postgres:postgres@localhost:5432/freeburger?sslmode=disable' \
  python seed_cards.py realgo_subpattern_cards.yaml --roadmap ''
```

Локальная проверка YAML без подключения к Postgres:

```sh
cd services/api/seeds
python seed_cards.py realgo_subpattern_cards.yaml --validate-only --roadmap ''
```

Идемпотентность и `source`-схема - те же, что у `realgo_demo_cards.yaml`
(см. выше): `source = "realgo_subpattern_cards:{key}"`, повторный запуск
обновляет карточки на месте и сохраняет review history.

## Demo Users

`seed_users.py` создаёт предсозданные аккаунты для ручного тестирования и
кладёт им прогресс, due review schedules, review attempts и extension events
по задачам из `neetcode_150`. Также добавляет demo review schedules для
паттернов и, если `seed_cards.py` уже загружен, для карточек. Перед ним должен
быть загружен roadmap seed; для полной очереди `problem/card/pattern` сначала
загрузи `seed-cards`.

Все demo-аккаунты помечаются как прошедшие onboarding, чтобы после входа сразу
открывался кабинет, а не первичная настройка профиля.

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
