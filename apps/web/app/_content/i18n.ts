export const supportedLocales = ["ru", "en", "es"] as const;

export type Locale = (typeof supportedLocales)[number];

export const defaultLocale: Locale = "ru";

const ru = {
  common: {
    brand: "Engram",
    metadata: {
      title: "Engram — Memory layer for interview prep",
      description:
        "Engram helps you remember solved interview tasks, review them at the right time, and prepare with a clearer plan.",
    },
  },
  pwa: {
    name: "Engram — Memory layer for interview prep",
    shortName: "Engram",
    description:
      "Engram helps you remember solved interview tasks, review them at the right time, and prepare with a clearer plan.",
  },
  marketing: {
    hero: {
      homeAria: "Engram home",
      navAria: "Site sections",
      nav: ["Memory", "Roadmap", "Reviews", "Pricing"],
      auth: {
        login: "Log in",
        signup: "Sign up",
        createAccount: "Create account",
        continue: "Continue",
        email: "Email",
        emailPlaceholder: "you@company.com",
        password: "Password",
        passwordPlaceholder: "••••••••",
        interviewDate: "Interview date",
        loginAria: "Log in",
        signupAria: "Create account",
      },
      sortingCodeAria: "Sorting code",
      eyebrow: "// spaced-repetition for interview prep",
      tagline:
        "Реши задачу один раз — Engram пересоберёт её в памяти к нужному дню. Перепиши код сортировки слева и запусти: алгоритм наводит порядок прямо в названии.",
      sortingControlsAria: "Sorting controls",
      wordAria: "engram",
      chaos: "Chaos",
      sort: "Sort",
      codeError: "Код не компилируется — Engram не смог его выполнить. Проверь синтаксис.",
    },
    memoryTasks: [
      ["Two Sum II", "Two Pointers", "повторить", "завтра"],
      ["Longest Substring", "Sliding Window", "закрепляется", "через 3 дня"],
      ["Valid Parentheses", "Stack", "уверенно", "на неделе"],
    ],
    roadmapWeeks: [
      ["Неделя 1", "Arrays, Hashing, Two Pointers", "собрать базу, которая чаще всего встречается в задачах"],
      ["Неделя 2", "Sliding Window, Stack, Binary Search", "довести ключевые паттерны до уверенного воспроизведения"],
      ["Неделя 3", "Graphs, Intervals, Mock interview", "перейти от практики задач к формату интервью"],
    ],
    reviewCards: [
      [
        "Pattern",
        "Какой подход выбрать, если нужно найти пару чисел в отсортированном массиве?",
        "Two Pointers: быстрый способ сузить поиск без лишней памяти.",
      ],
      [
        "Mechanics",
        "Если сумма больше target, какой указатель нужно сдвинуть?",
        "Короткий вопрос возвращает в память конкретный шаг решения.",
      ],
      [
        "Edge case",
        "Что произойдёт, если подходящей пары нет?",
        "Карточка заранее закрепляет сценарий, на котором часто ошибаются под давлением.",
      ],
    ],
    pricing: [
      [
        "Free",
        "$0",
        [
          "Сохранение решённых задач прямо из браузера",
          "Оценка уверенности после каждой задачи",
          "Авто-расписание повторений (spaced repetition)",
          "Базовая статистика прогресса",
        ],
      ],
      [
        "Pro",
        "$12",
        [
          "Всё из Free",
          "Персональный план под роль и дату интервью",
          "Расширенные карточки: паттерны, шаги, граничные случаи",
          "Тесты и mock-режим перед интервью",
          "Экспорт в Anki",
          "Приоритетные напоминания",
        ],
      ],
    ],
    sections: {
      memory: {
        kicker: "Memory",
        title: "Решай задачи где удобно. Engram запомнит, что важно повторить.",
        description:
          "После практики ты отмечаешь уровень уверенности. Engram превращает это в понятное расписание повторений и возвращает к темам, которые нужно закрепить перед интервью.",
        demoUrl: "leetcode.com/problems/two-sum-ii",
        demoStatus: "Saved",
        ratingAria: "Difficulty rating",
        ratings: ["сложно", "нормально", "уверенно"],
      },
      roadmap: {
        kicker: "Roadmap",
        head: "Backend SWE · 21 день",
        readiness: "68% готовность",
        title: "План подготовки под твою цель и дату интервью.",
        description:
          "Укажи роль, компанию и сколько времени осталось. Engram соберёт маршрут по темам, задачам и повторениям, чтобы каждый день подготовки имел понятный следующий шаг.",
      },
      reviews: {
        kicker: "Reviews",
        title: "Повторяй паттерны так, чтобы вспомнить их на интервью.",
        description:
          "Engram создаёт короткие карточки по подходу, шагам решения и граничным случаям. Вместо длинных конспектов ты получаешь вопросы, которые тренируют воспроизведение.",
      },
      pricing: {
        kicker: "Pricing",
        title: "Начни бесплатно. Подключи Pro, когда нужна подготовка под конкретное интервью.",
        description:
          "Бесплатный план помогает собрать личную базу решённых задач. Pro добавляет маршрут под цель, больше повторений, тесты и экспорт в Anki.",
      },
    },
    footer: {
      description: "Память для подготовки к интервью. Решай, отмечай, возвращайся в нужный момент.",
      columns: [
        {
          title: "product",
          links: [
            { href: "#memory", label: "Memory" },
            { href: "#roadmap", label: "Roadmap" },
            { href: "#reviews", label: "Reviews" },
            { href: "#pricing", label: "Pricing" },
          ],
        },
        {
          title: "developers",
          links: [
            { href: "#", label: "Docs" },
            { href: "#", label: "API" },
            { href: "#", label: "Anki export" },
            { href: "#", label: "Changelog" },
          ],
        },
        {
          title: "company",
          links: [
            { href: "#", label: "About" },
            { href: "#", label: "Blog" },
            { href: "#", label: "Privacy" },
            { href: "#", label: "Terms" },
          ],
        },
      ],
      copyright: "© 2026 Engram. All rights reserved.",
      tagline: "built for people who interview",
    },
  },
  cabinet: {
    layout: {
      navAria: "Personal cabinet",
      navGroups: [
        {
          title: "подготовка",
          items: [
            { href: "/dashboard", label: "dashboard", icon: "dashboard", count: "" },
            { href: "/reviews", label: "reviews", icon: "reviews", count: "12" },
            { href: "/problems", label: "problems", icon: "problems", count: "" },
            { href: "/cards", label: "cards", icon: "cards", count: "6" },
          ],
        },
        {
          title: "аналитика",
          items: [
            { href: "/roadmap", label: "roadmap", icon: "roadmap", count: "" },
            { href: "/patterns", label: "patterns", icon: "patterns", count: "4" },
          ],
        },
        {
          title: "система",
          items: [
            { href: "/extension", label: "extension", icon: "extension", count: "" },
            { href: "/settings", label: "settings", icon: "settings", count: "" },
          ],
        },
      ],
      eyebrow: "// personal memory layer",
      backToMarketing: "back to marketing",
      profile: {
        monogram: "BS",
        name: "Backend SWE",
        meta: "interview · через 21 день",
        plan: "free mock",
        menuAria: "Открыть аккаунт",
      },
    },
    common: {
      startReview: "Start review",
      hard: "hard",
      normal: "normal",
      easy: "easy",
      ratingAria: "Mock review rating",
    },
    pages: {
      dashboard: {
        eyebrow: "/dashboard",
        title: "Сегодня повторяем то, что реально может забыться.",
        description:
          "Каждый день Engram собирает короткую очередь повторений, подсвечивает слабые темы и показывает, насколько ты готов к интервью — чтобы решённое не забывалось до собеседования.",
        nextAction: "next action",
        nextUp: "next up",
        nextTitle: "Longest Substring",
        nextMeta: "Sliding Window · hard · сегодня",
        openQueue: "Перейти к очереди",
        queueEyebrow: "queue",
        queueTitle: "Ближайшие повторения",
        patternsEyebrow: "patterns",
        patternsTitle: "Слабые зоны",
        roadmapEyebrow: "roadmap",
        roadmapTitle: "Engram Core Roadmap",
      },
      reviews: {
        eyebrow: "/reviews",
        title: "Очередь повторений",
        description:
          "То, что Engram советует повторить сегодня: задачи, паттерны и карточки — по одному короткому подходу на каждый.",
        summaryUnit: "повторений сегодня",
        types: [
          ["problem review", "задачи", "accent"],
          ["card", "карточки", "success"],
          ["pattern review", "паттерны", "warning"],
        ],
        panelEyebrow: "today",
        panelTitle: "Review queue",
      },
      problems: {
        eyebrow: "/problems",
        title: "Личная база задач",
        description:
          "Все задачи, которые ты решил и сохранил — расширением из браузера или вручную. Отсюда Engram планирует повторения.",
        panelEyebrow: "library",
        panelTitle: "Saved problems",
        summaryUnit: "задач в библиотеке",
        nextLabel: "следующее повторение",
        statuses: [
          ["saved", "сохранена", "default"],
          ["reviewing", "повторяется", "accent"],
          ["mastered", "освоена", "success"],
        ],
      },
      roadmap: {
        eyebrow: "/roadmap",
        title: "Engram Core Roadmap",
        description:
          "План подготовки на 21 день: от базовых паттернов до формата интервью. На каждой неделе — свой набор тем и прогресс по ним.",
        panelEyebrow: "plan",
        panelTitle: "21-day preparation track",
        overallLabel: "общий прогресс трека",
        statusDone: "пройдено",
        statusActive: "в работе",
        statusTodo: "впереди",
      },
      patterns: {
        eyebrow: "/patterns",
        title: "Паттерны и confidence",
        description:
          "Темы, где уверенность проседает. Engram показывает не просто «реши ещё», а что именно закрепить в первую очередь.",
        panelEyebrow: "weak spots",
        panelTitle: "Pattern confidence",
        summaryUnit: "паттерна требуют внимания",
        confidenceLabel: "уверенность",
        priorityHigh: "высокий приоритет",
        priorityMed: "стоит повторить",
      },
      cards: {
        eyebrow: "/cards",
        title: "Карточки повторения",
        description:
          "Короткие карточки на распознавание паттерна, механику алгоритма и пограничные случаи — без готового кода, только суть.",
        panelEyebrow: "anki-like",
        panelTitle: "Today cards",
        overview: {
          readyEyebrow: "ready",
          readyTitle: "Короткая сессия без лишнего шума.",
          readyDescription:
            "Сначала попробуй воспроизвести ответ самостоятельно. Затем открой правильный ответ и честно оцени сложность.",
          start: "Начать сессию",
          cardsCount: "6 карточек",
          estimatedTime: "~5 минут",
          mixEyebrow: "today's mix",
          mixTitle: "Что повторяем сегодня",
          cardUnit: "карт.",
          types: [
            ["Pattern Recognition", "Распознавание паттерна"],
            ["Algorithm Mechanics", "Механика алгоритма"],
            ["Edge Case", "Пограничные случаи"],
          ],
          methodEyebrow: "method",
          methodTitle: "Как проходит повторение",
          methodSteps: [
            ["01", "Вспомни", "Сформулируй ответ до того, как перевернёшь карточку."],
            ["02", "Сверь", "Открой короткий правильный ответ и найди пробел."],
            ["03", "Оцени", "Hard вернётся в очередь, normal/easy завершат карточку."],
          ],
        },
        session: {
          loading: "Loading card session…",
          progress: "reviewed",
          remaining: "remaining",
          showAnswer: "Show answer",
          hideAnswer: "Hide answer",
          ratePrompt: "Как вспомнилось?",
          hardHint: "вернуть в очередь",
          normalHint: "закрепить позже",
          easyHint: "считать уверенной",
          reset: "Reset session",
          completedEyebrow: "session complete",
          completedTitle: "Карточки на сегодня разобраны.",
          completedDescription:
            "Моковая сессия сохранена локально. Hard-карточки возвращались в очередь, easy/normal закрывали карточку на сегодня.",
          startAgain: "Start again",
          lastReviews: "Last ratings",
          answerLabel: "answer",
          questionLabel: "question",
          nextReview: {
            hard: "сегодня ещё раз",
            normal: "через 3 дня",
            easy: "через 7 дней",
          },
          emptyHistory: "Оценок пока нет — открой ответ и выбери сложность.",
          sessionCompleteTitle: "Engram cards complete",
          sessionCompleteBody: "Карточки на сегодня разобраны. Завтра вернём нужные паттерны.",
          focus: {
            exit: "Exit session",
            progress: "Card",
            of: "of",
            showAnswer: "Show answer",
            answerPrompt: "Сравни ответ со своей формулировкой",
            ratePrompt: "Насколько легко удалось воспроизвести ответ?",
            keyboardHint: "Space — показать ответ · 1 — Easy · 2 — Normal · 3 — Hard",
            hard: "Hard",
            normal: "Normal",
            easy: "Easy",
            hardHint: "повторить ещё раз",
            normalHint: "вернуться позже",
            easyHint: "ответ уверенный",
            completedEyebrow: "session complete",
            completedTitle: "Повторение завершено.",
            completedDescription:
              "Сессия сохранена локально. Карточки с оценкой hard уже вернулись в очередь и были повторены.",
            repeatDue: "Repeat hard/normal",
            repeatDueFallback: "Start full review again",
            returnToCards: "Return to cards",
          },
        },
      },
      extension: {
        eyebrow: "/extension",
        title: "Расширение и синхронизация",
        description:
          "Расширение само сохраняет решённые задачи и оценки прямо из браузера. Храним только нужный минимум — без содержимого страниц.",
        statusEyebrow: "status",
        statusTitle: "Connection",
        status: "connected",
        statusDescription:
          "Авто-синхронизация включена для LeetCode: решённые задачи и оценки попадают в кабинет автоматически.",
        disableSync: "Отключить авто-синхронизацию",
        liveLabel: "на связи",
        platform: "LeetCode",
        eventsEyebrow: "events",
        eventsTitle: "Последние события",
        eventTypes: [
          ["problem_solved", "решено", "success"],
          ["rating_changed", "оценка обновлена", "accent"],
          ["problem_viewed", "просмотрено", "default"],
        ],
      },
      settings: {
        eyebrow: "/settings",
        title: "Настройки аккаунта",
        description:
          "Профиль, дата интервью, установка приложения, напоминания и приватность — всё, что настраивает твою подготовку.",
        profileEyebrow: "profile",
        profileTitle: "Preparation settings",
        installEyebrow: "pwa",
        installTitle: "Install Engram",
        notificationsEyebrow: "notifications",
        notificationsTitle: "Review reminders",
        privacyEyebrow: "privacy",
        privacyTitle: "Data controls",
        privacyDescription:
          "Не вставляй NDA-материалы, premium/editorial-контент, скриншоты интервью или чужие закрытые материалы в заметки и AI-поля.",
        exportProgress: "Export progress",
        deleteAccount: "Delete account",
        settings: [
          ["email", "demo@engram.dev"],
          ["timezone", "Europe/Moscow"],
          ["interview date", "2026-07-20"],
        ],
        planLabel: "plan",
        plan: "Free mock",
        install: {
          description:
            "Сохрани Engram как приложение, чтобы открывать кабинет и карточки с домашнего экрана.",
          install: "Install app",
          installed: "installed",
          iosHint: "Если кнопка недоступна, используй меню браузера: Share → Add to Home Screen.",
          ready: "ready to install",
          unavailable: "browser install prompt unavailable",
        },
        notifications: {
          description:
            "Уведомления работают локально через браузер/PWA. Push-сервер и backend-синхронизация будут подключаться отдельно.",
          enable: "Enable notifications",
          enabled: "notifications enabled",
          disabled: "permission required",
          permissionDenied: "permission denied in browser",
          permissionGranted: "permission granted",
          permissionUnsupported: "notifications unsupported",
          dailyReminder: "Daily preparation reminder",
          cardReviewReminder: "Cards due reminder",
          streakReminder: "Streak protection reminder",
          reminderTime: "Reminder time",
          sendTest: "Send test notification",
          testTitle: "Engram review reminder",
          testBody: "Карточки ждут короткого повторения.",
          testSent: "test notification sent",
        },
      },
    },
    mock: {
      overviewStats: [
        {
          label: "today queue",
          value: "12",
          hint: "8 задач, 3 карточки, 1 паттерн",
          tone: "accent",
          icon: "queue",
          tooltip: "Сколько повторений запланировано на сегодня: задачи, карточки и паттерны, у которых подошёл срок.",
        },
        {
          label: "readiness",
          value: "68%",
          hint: "готовность к интервью",
          tone: "success",
          icon: "readiness",
          tooltip: "Оценка готовности к собеседованию по твоему прогрессу: решённые задачи, закрытые повторения и слабые места.",
        },
        {
          label: "weak spots",
          value: "4",
          hint: "паттерна требуют повторения",
          tone: "warning",
          icon: "weak",
          tooltip: "Паттерны, где уверенность ниже порога — их стоит повторить в первую очередь.",
        },
        {
          label: "streak",
          value: "6d",
          hint: "без пропуска повторений",
          tone: "default",
          icon: "streak",
          tooltip: "Сколько дней подряд ты не пропускаешь повторения. Серия помогает не бросить подготовку.",
        },
      ],
      reviewQueue: [
        {
          id: 1,
          title: "Longest Substring Without Repeating Characters",
          meta: "Sliding Window · medium",
          type: "problem review",
          next: "сегодня · 09:30",
          rating: "hard",
        },
        {
          id: 2,
          title: "Когда выбирать Two Pointers?",
          meta: "Pattern Recognition · card",
          type: "card",
          next: "сегодня · 11:00",
          rating: "normal",
        },
        {
          id: 3,
          title: "Binary Search on Answer",
          meta: "Pattern · weak confidence",
          type: "pattern review",
          next: "сегодня · 14:00",
          rating: "hard",
        },
        {
          id: 4,
          title: "Valid Parentheses",
          meta: "Stack · easy",
          type: "problem review",
          next: "сегодня · 18:30",
          rating: "easy",
        },
      ],
      weakPatterns: [
        { name: "Sliding Window", confidence: 42, signal: "3 hard reviews за неделю" },
        { name: "Binary Search", confidence: 48, signal: "часто путается граница right" },
        { name: "Intervals", confidence: 55, signal: "мало повторений после решения" },
        { name: "Dynamic Programming", confidence: 37, signal: "нужны карточки по состояниям" },
      ],
      problems: [
        { title: "Two Sum II", platform: "LeetCode", pattern: "Two Pointers", status: "reviewing", next: "завтра" },
        {
          title: "Longest Substring",
          platform: "LeetCode",
          pattern: "Sliding Window",
          status: "reviewing",
          next: "сегодня",
        },
        { title: "Valid Parentheses", platform: "NeetCode", pattern: "Stack", status: "mastered", next: "через 7 дней" },
        {
          title: "Search in Rotated Sorted Array",
          platform: "LeetCode",
          pattern: "Binary Search",
          status: "saved",
          next: "не назначено",
        },
      ],
      roadmapWeeks: [
        {
          week: "week 01",
          title: "Arrays, Hashing, Two Pointers",
          progress: 82,
          focus: "собрать базу и закрыть быстрые повторения",
        },
        {
          week: "week 02",
          title: "Sliding Window, Stack, Binary Search",
          progress: 46,
          focus: "довести слабые паттерны до воспроизведения",
        },
        {
          week: "week 03",
          title: "Graphs, Intervals, Mock interview",
          progress: 18,
          focus: "перейти от решения задач к интервью-формату",
        },
      ],
      cards: [
        {
          id: "two-pointers-recognition",
          type: "Pattern Recognition",
          source: "Two Sum II · Two Pointers",
          front: "Дан отсортированный массив и target. Какой подход выбрать?",
          back: "Two Pointers: двигаем left/right внутрь по сравнению суммы с target.",
        },
        {
          id: "sliding-window-mechanics",
          type: "Algorithm Mechanics",
          source: "Longest Substring · Sliding Window",
          front: "Sliding Window: когда сдвигать left?",
          back: "Когда окно нарушило ограничение; уменьшаем окно до валидного состояния.",
        },
        {
          id: "binary-search-edge-case",
          type: "Edge Case",
          source: "Binary Search · bounds",
          front: "Binary Search: что проверять при пустом диапазоне?",
          back: "Условие выхода и корректность границ, чтобы не зациклиться.",
        },
        {
          id: "intervals-recognition",
          type: "Pattern Recognition",
          source: "Merge Intervals · Intervals",
          front: "Интервалы нужно объединять. Какой первый шаг почти всегда нужен?",
          back: "Отсортировать интервалы по началу, затем идти слева направо и расширять текущий merged interval.",
        },
        {
          id: "dp-state",
          type: "Algorithm Mechanics",
          source: "Climbing Stairs · Dynamic Programming",
          front: "DP: зачем явно формулировать состояние перед переходом?",
          back: "Состояние определяет, что хранит dp[i]. Без него легко написать переход, который считает не ту величину.",
        },
        {
          id: "stack-edge-case",
          type: "Edge Case",
          source: "Valid Parentheses · Stack",
          front: "Что проверить после прохода по строке со скобками?",
          back: "Стек должен быть пустым. Иначе остались незакрытые открывающие скобки.",
        },
      ],
      extensionEvents: [
        { source: "leetcode", event: "problem_solved", title: "Two Sum II", time: "2 мин назад" },
        { source: "leetcode", event: "rating_changed", title: "Longest Substring", time: "1 час назад" },
        { source: "neetcode", event: "problem_viewed", title: "Valid Parentheses", time: "вчера" },
      ],
    },
  },
} as const;

export type Dictionary = typeof ru;

const dictionaries: Record<Locale, Dictionary> = {
  ru,
  en: ru,
  es: ru,
};

export function getDictionary(locale: Locale = defaultLocale) {
  return dictionaries[locale];
}

export function isSupportedLocale(value: string): value is Locale {
  return supportedLocales.includes(value as Locale);
}
