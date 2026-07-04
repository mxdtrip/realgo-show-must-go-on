"use client";

import type { ReviewCard, ReviewLog } from "../_state/useCardReviewSession";

type CardSessionSummaryProps = {
  cardsById: Map<string, ReviewCard>;
  copy: {
    completedDescription: string;
    completedEyebrow: string;
    completedTitle: string;
    emptyHistory: string;
    lastReviews: string;
    startAgain: string;
  };
  history: readonly ReviewLog[];
  onReset: () => void;
};

export function CardSessionSummary({ cardsById, copy, history, onReset }: Readonly<CardSessionSummaryProps>) {
  return (
    <section className="card-session-summary">
      <span>{copy.completedEyebrow}</span>
      <h2>{copy.completedTitle}</h2>
      <p>{copy.completedDescription}</p>
      <button type="button" onClick={onReset}>
        {copy.startAgain}
      </button>

      <div className="card-history">
        <h3>{copy.lastReviews}</h3>
        {history.length === 0 ? <p>{copy.emptyHistory}</p> : null}
        {history.slice(0, 6).map((item) => {
          const card = cardsById.get(item.cardId);
          return (
            <article key={`${item.cardId}-${item.reviewedAt}`}>
              <strong>{card?.front ?? item.cardId}</strong>
              <span>{item.rating}</span>
              <em>{item.nextReview}</em>
            </article>
          );
        })}
      </div>
    </section>
  );
}
