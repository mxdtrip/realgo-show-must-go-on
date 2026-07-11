// Demo content for the /cards launcher's "mix" breakdown. Shown to
// unauthenticated/demo visitors; authenticated due-counts come from
// GET /me/cards/session instead (see page.tsx).
export type MockCard = {
  id: string;
  type: "pattern_recognition" | "algorithm_mechanics" | "edge_case";
  source: {
    entityType: "problem";
    entityId: string;
    label: string;
  };
  front: string;
  back: string;
  status: "new" | "due" | "learning" | "mastered" | "archived";
  nextReviewAt: string;
  lastRating: "hard" | "normal" | "easy";
  createdAt: string;
};

export const cardRecords: readonly MockCard[] = [
  {
    id: "two-pointers-recognition",
    type: "pattern_recognition",
    source: {
      entityType: "problem",
      entityId: "prb_mock_two_sum_ii",
      label: "Two Sum II · Two Pointers",
    },
    front: "Дан отсортированный массив и target. Какой подход выбрать?",
    back: "Two Pointers: двигаем left/right внутрь по сравнению суммы с target.",
    status: "due",
    nextReviewAt: "2026-06-30T09:30:00Z",
    lastRating: "normal",
    createdAt: "2026-06-28T20:10:00Z",
  },
  {
    id: "sliding-window-mechanics",
    type: "algorithm_mechanics",
    source: {
      entityType: "problem",
      entityId: "prb_mock_longest_substring",
      label: "Longest Substring · Sliding Window",
    },
    front: "Sliding Window: когда сдвигать left?",
    back: "Когда окно нарушило ограничение; уменьшаем окно до валидного состояния.",
    status: "due",
    nextReviewAt: "2026-06-30T10:10:00Z",
    lastRating: "hard",
    createdAt: "2026-06-24T14:20:00Z",
  },
  {
    id: "binary-search-edge-case",
    type: "edge_case",
    source: {
      entityType: "problem",
      entityId: "prb_mock_binary_search",
      label: "Binary Search · bounds",
    },
    front: "Binary Search: что проверять при пустом диапазоне?",
    back: "Условие выхода и корректность границ, чтобы не зациклиться.",
    status: "due",
    nextReviewAt: "2026-06-30T11:00:00Z",
    lastRating: "normal",
    createdAt: "2026-06-22T09:45:00Z",
  },
  {
    id: "intervals-recognition",
    type: "pattern_recognition",
    source: {
      entityType: "problem",
      entityId: "prb_mock_merge_intervals",
      label: "Merge Intervals · Intervals",
    },
    front: "Интервалы нужно объединять. Какой первый шаг почти всегда нужен?",
    back: "Отсортировать интервалы по началу, затем идти слева направо и расширять текущий merged interval.",
    status: "due",
    nextReviewAt: "2026-06-30T12:30:00Z",
    lastRating: "easy",
    createdAt: "2026-06-20T18:35:00Z",
  },
  {
    id: "dp-state",
    type: "algorithm_mechanics",
    source: {
      entityType: "problem",
      entityId: "prb_mock_climbing_stairs",
      label: "Climbing Stairs · Dynamic Programming",
    },
    front: "DP: зачем явно формулировать состояние перед переходом?",
    back: "Состояние определяет, что хранит dp[i]. Без него легко написать переход, который считает не ту величину.",
    status: "due",
    nextReviewAt: "2026-06-30T14:00:00Z",
    lastRating: "hard",
    createdAt: "2026-06-18T16:05:00Z",
  },
  {
    id: "stack-edge-case",
    type: "edge_case",
    source: {
      entityType: "problem",
      entityId: "prb_mock_valid_parentheses",
      label: "Valid Parentheses · Stack",
    },
    front: "Что проверить после прохода по строке со скобками?",
    back: "Стек должен быть пустым. Иначе остались незакрытые открывающие скобки.",
    status: "due",
    nextReviewAt: "2026-06-30T16:20:00Z",
    lastRating: "easy",
    createdAt: "2026-06-15T08:30:00Z",
  },
];
