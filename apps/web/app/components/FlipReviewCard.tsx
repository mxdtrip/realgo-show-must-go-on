"use client";

import { useEffect, useState } from "react";

/**
 * Landing "reviews" section demo card — same 3D flip mechanic as the real
 * card-session player (.focus-card in globals.css: perspective + rotateY +
 * backface-visibility), scaled down to grid-card size. Front shows the
 * question, back shows the answer; click/Enter/Space toggles.
 */
export function FlipReviewCard({
  type,
  front,
  back,
  flipAria,
}: Readonly<{ type: string; front: string; back: string; flipAria: { showAnswer: string; showQuestion: string } }>) {
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    if (!flipped) return;
    const timer = setTimeout(() => setFlipped(false), 3000);
    return () => clearTimeout(timer);
  }, [flipped]);

  return (
    <div className="review-flip">
      <button
        className={flipped ? "review-flip__card review-flip__card--back" : "review-flip__card"}
        type="button"
        aria-pressed={flipped}
        aria-label={flipped ? flipAria.showQuestion : flipAria.showAnswer}
        onClick={() => setFlipped((value) => !value)}
      >
        <span className="review-flip__inner">
          <span className="review-flip__face review-flip__face--front" aria-hidden={flipped}>
            <span>{type}</span>
            <h3>{front}</h3>
          </span>
          <span className="review-flip__face review-flip__face--back" aria-hidden={!flipped}>
            <span>{type}</span>
            <p>{back}</p>
          </span>
        </span>
      </button>
    </div>
  );
}
