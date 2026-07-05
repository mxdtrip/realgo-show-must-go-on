"use client";

import type { ReviewCard } from "../_state/useCardReviewSession";

type FlashcardProps = {
  card: ReviewCard;
  isFlipped: boolean;
  labels: {
    answer: string;
    hideAnswer: string;
    question: string;
    showAnswer: string;
    aiBadgeTitle?: string;
  };
  onToggle: () => void;
};

export function Flashcard({ card, isFlipped, labels, onToggle }: Readonly<FlashcardProps>) {
  return (
    <article className={`flashcard ${isFlipped ? "flashcard--flipped" : ""}`}>
      <div className="flashcard__meta">
        <span>{card.type}</span>
        {card.createdByAi ? (
          <b className="card-ai-badge" title={labels.aiBadgeTitle}>
            AI
          </b>
        ) : null}
        <em>{card.source}</em>
      </div>
      <div className="flashcard__body">
        <span>{isFlipped ? labels.answer : labels.question}</span>
        <h2>{isFlipped ? card.back : card.front}</h2>
      </div>
      <button className="flashcard__toggle" type="button" onClick={onToggle}>
        {isFlipped ? labels.hideAnswer : labels.showAnswer}
      </button>
    </article>
  );
}
