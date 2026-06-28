# FreeBurger

Монорепозиторий backend-сервисов, веб-приложения и браузерного расширения.

## Структура

```text
.
├── apps/
│   ├── web/                 # Next.js, React, TypeScript, Tailwind, shadcn/ui
│   └── extension/           # Plasmo, TypeScript, Manifest V3
├── services/
│   └── api/                 # Go API
│       ├── cmd/api/         # Точка входа бинарного приложения
│       ├── internal/        # Закрытая бизнес-логика и адаптеры
│       └── migrations/      # Миграции базы данных
└── packages/
    ├── ui/                  # Общие React-компоненты и дизайн-токены
    ├── shared/              # Общие TypeScript-типы и чистая логика
    └── config/              # Общие настройки TypeScript, ESLint, Tailwind
```

## Архитектурные границы

- `apps/*` — запускаемые frontend-приложения. Они могут зависеть от `packages/*`, но не друг от друга.
- `services/*` — независимо собираемые Go-сервисы. Код конкретного сервиса находится в его `internal`.
- `packages/ui` — визуальные React-компоненты. Компоненты shadcn/ui добавляются сюда только если действительно используются обоими приложениями; специфичные компоненты остаются внутри приложения.
- `packages/shared` — платформонезависимые TypeScript-типы, схемы и утилиты без React, Next.js и Plasmo API.
- `packages/config` — единые настройки инструментов без продуктового кода.

В корне позже следует разместить Node workspace (`pnpm-workspace.yaml` или аналог выбранного package manager) и `go.work`, когда будут известны имена модулей. Lock-файл package manager должен храниться в Git.

## Приложения и сервисы

- [Web](apps/web/README.md)
- [Browser Extension](apps/extension/README.md)
- [Go API](services/api/README.md)

Правила создания веток, коммитов и pull request описаны в [CONTRIBUTING.md](CONTRIBUTING.md).
