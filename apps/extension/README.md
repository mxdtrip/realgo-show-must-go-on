# Browser Extension

Браузерное расширение на Plasmo и TypeScript с Manifest V3.

Background worker, content scripts, popup, options и разрешения остаются внутри этого приложения. Общий с web код подключается только из `packages/shared` или `packages/ui` и не должен зависеть от browser-only API.
