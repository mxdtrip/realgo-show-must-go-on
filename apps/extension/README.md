# Browser Extension

Браузерное расширение realgo на Plasmo и TypeScript с Manifest V3.

Background worker, content scripts, popup, options и разрешения остаются внутри этого приложения. Общий с web код подключается только из `packages/shared` или `packages/ui` и не должен зависеть от browser-only API.

## Что делает

После того как пользователь отправляет решение задачи на **LeetCode**,
**GeeksforGeeks**, **HackerRank** или **Codeforces**, расширение фиксирует
факт submit, показывает короткий popup realgo с названием задачи и оценкой
сложности, затем отправляет результат в backend, откуда он попадает в
персональную систему повторений.

Поддержка платформ построена на адаптерах (`src/platforms`), что делает
подключение новой площадки локальным изменением, а не переписыванием
расширения. LeetCode, GeeksforGeeks и HackerRank ловят submit в месте на
странице — те же логика клика и MutationObserver, разный набор селекторов.
Codeforces устроен иначе: страница задачи не содержит редактор, кнопка
«Submit» уводит на отдельную форму, а вердикт появляется на странице статуса
посылок — адаптер помечает себя `crossPage`, и снапшот задачи переживает
переход через `chrome.storage.local` (см. `lib/storage.ts`
`*CrossPageSubmitIntent`, `contents/realgo.ts` `resumeCrossPageWatch`).

⚠️ Адаптеры GeeksforGeeks и Codeforces собраны по той же защитной схеме, что
и LeetCode/HackerRank (несколько селекторов-кандидатов, деградация в
`"unknown"` вместо падения), но, в отличие от них, ещё не проверялись на
живых страницах — вёрстка обеих площадок меняется без предупреждения. Собрать
`build/chrome-mv3-dev`, пройти реальный submit на geeksforgeeks.org и
codeforces.com и поправить селекторы по месту — обязательный шаг перед тем,
как считать эти два адаптера боевыми (тот же принцип, что у Firefox ниже).

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

- **API base URL** — по умолчанию `https://realgo.dev`; для локальной разработки
  можно вручную поставить `http://localhost:8080`;
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
npm run package        # Web Store / team zip через Plasmo
npm run package:crx:mac # signed CRX через локальный Chrome и приватный ключ

# Firefox (MV3, стабильный extension id через browser_specific_settings.gecko.id)
npm run dev:firefox    # build/firefox-mv3-dev
npm run build:firefox  # build/firefox-mv3-prod ← about:debugging → This Firefox → Load Temporary Add-on

# Предпросмотр popup как веб-страницы
npm run preview        # http://localhost:5174

# Проверка типов
npm run typecheck
```

## Firefox-совместимость (#309)

Проверено сборкой (не живым браузером): `plasmo build --target=firefox-mv3`
проходит чисто, манифест транслируется корректно (`background.scripts` вместо
`service_worker`, свой `browser_specific_settings.gecko.id` вместо
Chrome-only `key`). Кодовая база уже была написана с оглядкой на кроссбраузерность:
`chrome.action.openPopup()` в `background.ts` изначально обёрнут в try/catch с
документированным fallback на in-page overlay (эта API не гарантирована даже
в самом Chrome вне user gesture), `chrome.permissions.*` в `options.tsx` уже
проверяет `typeof chrome === "undefined"` перед вызовом.

**Не проверено** (нужен живой Firefox, недоступен из этого окружения): реальная
детекция submit на LeetCode/HackerRank, popup/overlay рендеринг, полный auth-флоу
через `chrome.storage.local`. Загрузить `build/firefox-mv3-prod` через
`about:debugging` → «This Firefox» → «Load Temporary Add-on» и прогнать вручную
(см. #81 матрицу тестов) — обязательный шаг перед тем, как считать #309 закрытой.

## Extension ID и упаковка

ID закреплён через публичный `manifest.key` в `package.json`:

```text
kclglopmphebagjjimjhdpnmoddmbgea
```

Приватный signing key не коммитится. Локально он ожидается здесь:

```bash
~/.realgo/extension/realgo-extension.pem
```

Если ключ потерян, новый ключ даст новый extension ID, и `REALGO_EXTENSION_ORIGIN`
в Caddy нужно будет обновить.

Для Chrome Web Store / передачи команде:

```bash
npm run package
```

Plasmo собирает production zip из `build/chrome-mv3-prod`. Для самоподписанного
CRX на macOS:

```bash
npm run package:crx:mac
```

Можно переопределить путь к ключу:

```bash
REALGO_EXTENSION_KEY=/secure/path/realgo-extension.pem npm run package:crx:mac
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
