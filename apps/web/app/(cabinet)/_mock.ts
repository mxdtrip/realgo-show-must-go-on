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
