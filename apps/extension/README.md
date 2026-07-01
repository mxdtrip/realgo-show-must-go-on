# Browser Extension

Браузерное расширение realgo на Plasmo и TypeScript с Manifest V3.

Background worker, content scripts, popup, options и разрешения остаются внутри этого приложения. Общий с web код подключается только из `packages/shared` или `packages/ui` и не должен зависеть от browser-only API.

## Что делает (MVP)

После того как пользователь отправляет решение задачи на **NeetCode**, расширение
фиксирует факт submit, показывает короткий popup realgo с названием задачи и двумя
вопросами (как далась / сможешь ли решить заново) и отправляет результат в backend,
откуда он попадает в персональную систему повторений (FSRS).

Поддержка платформ построена на адаптерах (`src/platforms`): в MVP включён NeetCode,
LeetCode заложен заглушкой.

## Структура

```text
src/
├── background.ts          # service worker: хранит последний submit, бейдж, попытка открыть popup
├── popup.tsx              # toolbar-popup (Plasmo), показывает последнюю задачу
├── options.tsx            # настройки: API base URL + вход по email/password
├── contents/realgo.ts     # content script: детект submit + результата, fallback-overlay
├── platforms/             # detectPlatform / extractTaskInfo / detectSubmit / detectSubmitResult
├── popup/
│   ├── PopupApp.tsx        # сам компонент popup (переиспользуется popup/overlay/preview)
│   ├── popup.styles.ts     # стили-строка (дизайн-токены realgo), инжект через <style>
│   └── mock.ts             # mock-задача для preview
└── lib/                    # types, storage (chrome.storage), api-клиент
preview/                    # standalone Vite-страница предпросмотра popup
```

## Авторизация

Откройте настройки расширения (`chrome://extensions` → realgo → Details →
Extension options):

- **API base URL** — например `http://localhost:8080`;
- **Вход в realgo** — email + пароль. Расширение логинится через
  `POST /api/v1/auth/login`, хранит access + refresh токены в `chrome.storage` и
  **обновляет access-токен автоматически** при истечении (`/api/v1/auth/refresh`).
  Кнопка «Выйти» отзывает сессию (`/api/v1/auth/logout`).

`POST /api/v1/extension/events` требует Bearer-токен, сохраняет задачу и ставит
ее в очередь повторений. Ошибки сети, сервера и авторизации показываются в popup.

## Команды

```bash
npm install

# Разработка расширения (Plasmo dev, HMR)
npm run dev            # build/chrome-mv3-dev

# Прод-сборка расширения
npm run build          # build/chrome-mv3-prod  ← это грузим в Chrome (Load unpacked)

# Предпросмотр popup как веб-страницы
npm run preview        # http://localhost:5174

# Проверка типов
npm run typecheck
```

## Загрузка в Chrome

1. `npm run build` (или `npm run dev`).
2. `chrome://extensions` → включить **Developer mode**.
3. **Load unpacked** → выбрать `apps/extension/build/chrome-mv3-prod`
   (для dev — `apps/extension/build/chrome-mv3-dev`).

## Docker preview

```bash
cd apps/extension
docker compose up           # → http://localhost:5174
```

Открывает ту же компоненту popup с mock-данными и переключателем состояний
(форма / загрузка / нет задачи / эмуляция ошибки) для проверки дизайна без submit.
