"use client";

import type { ReviewRating } from "../_state/useCardReviewSession";

type CardRatingControlsProps = {
  disabled: boolean;
  labels: {
    easy: string;
    easyHint: string;
    hard: string;
    hardHint: string;
    normal: string;
    normalHint: string;
    prompt: string;
  };
  onRate: (rating: ReviewRating) => void;
};

const ratings = ["hard", "normal", "easy"] as const;

export function CardRatingControls({ disabled, labels, onRate }: Readonly<CardRatingControlsProps>) {
  const hintByRating = {
    hard: labels.hardHint,
    normal: labels.normalHint,
    easy: labels.easyHint,
  };
  const labelByRating = {
    hard: labels.hard,
    normal: labels.normal,
    easy: labels.easy,
  };

  return (
    <section className="card-rating-panel" aria-label={labels.prompt}>
      <span>{labels.prompt}</span>
      <div>
        {ratings.map((rating) => (
          <button
            className={`card-rating-button card-rating-button--${rating}`}
            disabled={disabled}
            key={rating}
            type="button"
            onClick={() => onRate(rating)}
          >
            <strong>{labelByRating[rating]}</strong>
            <small>{hintByRating[rating]}</small>
          </button>
        ))}
      </div>
    </section>
  );
}
