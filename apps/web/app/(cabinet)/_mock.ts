import { getDictionary } from "../_content/i18n";

const { cabinet } = getDictionary();

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

const cardTypeLabels: Record<MockCard["type"], string> = {
  pattern_recognition: "Pattern Recognition",
  algorithm_mechanics: "Algorithm Mechanics",
  edge_case: "Edge Case",
};

export const overviewStats = cabinet.mock.overviewStats;
export const reviewQueue = cabinet.mock.reviewQueue;
export const weakPatterns = cabinet.mock.weakPatterns;
export const strongPatterns = cabinet.mock.strongPatterns;
export const problems = cabinet.mock.problems;
export const roadmapWeeks = cabinet.mock.roadmapWeeks;
export const cardRecords: readonly MockCard[] = cabinet.mock.cards;
export const cards = cardRecords.map((card) => ({
  id: card.id,
  type: cardTypeLabels[card.type],
  source: card.source.label,
  front: card.front,
  back: card.back,
}));
export const extensionEvents = cabinet.mock.extensionEvents;

// Deterministic PRNG so the mock heatmap is identical on server and client
// (Math.random here would break hydration).
function mulberry32(seed: number) {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const heatRand = mulberry32(20260702);

/** Last 28 days of review-activity levels (0–4): 4 rows × 7 days, newest last. */
export const activityWeeks: readonly (readonly number[])[] = Array.from({ length: 4 }, () =>
  Array.from({ length: 7 }, () => {
    const r = heatRand();
    if (r < 0.34) return 0;
    if (r < 0.56) return 1;
    if (r < 0.75) return 2;
    if (r < 0.9) return 3;
    return 4;
  }),
);

export const activityActiveDays = activityWeeks.flat().filter((level) => level > 0).length;
export const activityTotalReviews = activityWeeks.flat().reduce((sum, level) => sum + level * 2, 0);
