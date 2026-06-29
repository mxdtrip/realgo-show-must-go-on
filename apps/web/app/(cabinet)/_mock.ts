export const overviewStats = [
  {
    label: "today queue",
    value: "12",
    hint: "8 задач, 3 карточки, 1 паттерн",
    tone: "accent" as const,
  },
  {
    label: "readiness",
    value: "68%",
    hint: "по моковым данным подготовки",
    tone: "success" as const,
  },
  {
    label: "weak spots",
    value: "4",
    hint: "паттерна требуют повторения",
    tone: "warning" as const,
  },
  {
    label: "streak",
    value: "6d",
    hint: "без пропуска повторений",
    tone: "default" as const,
  },
];

export const reviewQueue = [
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
];

export const weakPatterns = [
  { name: "Sliding Window", confidence: 42, signal: "3 hard reviews за неделю" },
  { name: "Binary Search", confidence: 48, signal: "часто путается граница right" },
  { name: "Intervals", confidence: 55, signal: "мало повторений после решения" },
  { name: "Dynamic Programming", confidence: 37, signal: "нужны карточки по состояниям" },
];

export const problems = [
  {
    title: "Two Sum II",
    platform: "LeetCode",
    pattern: "Two Pointers",
    status: "reviewing",
    next: "завтра",
  },
  {
    title: "Longest Substring",
    platform: "LeetCode",
    pattern: "Sliding Window",
    status: "reviewing",
    next: "сегодня",
  },
  {
    title: "Valid Parentheses",
    platform: "NeetCode",
    pattern: "Stack",
    status: "mastered",
    next: "через 7 дней",
  },
  {
    title: "Search in Rotated Sorted Array",
    platform: "LeetCode",
    pattern: "Binary Search",
    status: "saved",
    next: "не назначено",
  },
];

export const roadmapWeeks = [
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
];

export const cards = [
  {
    type: "Pattern Recognition",
    front: "Дан отсортированный массив и target. Какой подход выбрать?",
    back: "Two Pointers: двигаем left/right внутрь по сравнению суммы с target.",
  },
  {
    type: "Algorithm Mechanics",
    front: "Sliding Window: когда сдвигать left?",
    back: "Когда окно нарушило ограничение; уменьшаем окно до валидного состояния.",
  },
  {
    type: "Edge Case",
    front: "Binary Search: что проверять при пустом диапазоне?",
    back: "Условие выхода и корректность границ, чтобы не зациклиться.",
  },
];

export const extensionEvents = [
  { source: "leetcode", event: "problem_solved", title: "Two Sum II", time: "2 мин назад" },
  { source: "leetcode", event: "rating_changed", title: "Longest Substring", time: "1 час назад" },
  { source: "neetcode", event: "problem_viewed", title: "Valid Parentheses", time: "вчера" },
];
