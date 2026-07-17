"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  getNotificationPermission,
  readNotificationSettings,
  showRealgoNotification,
} from "../../../_notifications/notifications";
import {
  type ReviewCard,
  type ReviewRating,
  useCardReviewSession,
} from "../_state/useCardReviewSession";

type FocusCopy = {
  completedDescription: string;
  completedEyebrow: string;
  completedTitle: string;
  loading: string;
  nextReview: Record<ReviewRating, string>;
  sessionCompleteBody: string;
  sessionCompleteTitle: string;
  focus: {
    aiBadgeTitle: string;
    answerPrompt: string;
    completedDescription: string;
    completedEyebrow: string;
    completedTitle: string;
    easy: string;
    easyHint: string;
    exit: string;
    hard: string;
    hardHint: string;
    keyboardHint: string;
    normal: string;
    normalHint: string;
    of: string;
    progress: string;
    ratePrompt: string;
    saveError: string;
    saving: string;
    repeatDue: string;
    repeatDueFallback: string;
    returnToCards: string;
    showAnswer: string;
  };
};

type FocusCardReviewSessionProps = {
  brand: string;
  cards: readonly ReviewCard[];
  copy: FocusCopy;
  /** Persists a rating before the UI advances to the next card. */
  onRate?: (cardId: string, rating: ReviewRating, reviewedAt: string) => void | Promise<void>;
};

const ratings = [
  { key: "easy", shortcut: "1" },
  { key: "normal", shortcut: "2" },
  { key: "hard", shortcut: "3" },
] as const;

const cardExitMs = 420;

export function FocusCardReviewSession({ brand, cards, copy, onRate }: Readonly<FocusCardReviewSessionProps>) {
  const [advanceRating, setAdvanceRating] = useState<ReviewRating | null>(null);
  const [rateError, setRateError] = useState("");
  const advanceTimeoutRef = useRef<number | null>(null);

  const notifyComplete = useCallback(() => {
    const settings = readNotificationSettings();
    if (!settings.enabled || !settings.cardReviewReminder || getNotificationPermission() !== "granted") return;
    void showRealgoNotification(copy.sessionCompleteTitle, {
      body: copy.sessionCompleteBody,
      data: { url: "/cards" },
      tag: "realgo-card-session-complete",
    });
  }, [copy.sessionCompleteBody, copy.sessionCompleteTitle]);

  const session = useCardReviewSession(cards, copy.nextReview, notifyComplete, onRate);
  const currentPosition = Math.min(session.completedUnique + 1, session.totalCards);
  const isAdvancing = advanceRating !== null;

  const advanceCard = useCallback(
    (rating: ReviewRating) => {
      if (!session.isFlipped || advanceRating !== null || advanceTimeoutRef.current !== null) return;

      setRateError("");
      setAdvanceRating(rating);
      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const delay = prefersReducedMotion ? 0 : cardExitMs;

      advanceTimeoutRef.current = window.setTimeout(() => {
        advanceTimeoutRef.current = null;
        void session
          .rate(rating)
          .catch(() => {
            setRateError(copy.focus.saveError);
          })
          .finally(() => {
            setAdvanceRating(null);
          });
      }, delay);
    },
    [advanceRating, copy.focus.saveError, session],
  );

  useEffect(() => {
    return () => {
      if (advanceTimeoutRef.current !== null) {
        window.clearTimeout(advanceTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.target instanceof Element &&
        event.target.closest("a, button, input, textarea, select, [contenteditable='true']")
      ) {
        return;
      }

      if (isAdvancing) return;

      if (event.code === "Space" || event.code === "Enter") {
        // Space/Enter toggles the card both ways (reveal answer ↔ back to front).
        event.preventDefault();
        session.setIsFlipped((flipped) => !flipped);
        return;
      }

      if (!session.isFlipped) return;
      if (event.key === "1") advanceCard("easy");
      if (event.key === "2") advanceCard("normal");
      if (event.key === "3") advanceCard("hard");
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [advanceCard, isAdvancing, session]);

  if (!session.isReady) {
    return <main className="focus-session focus-session--loading">{copy.loading}</main>;
  }

  if (session.isComplete || !session.currentCard) {
    return (
      <main className="focus-session">
        <div className="focus-gradient" aria-hidden="true" />
        <section className="focus-complete">
          <span>{copy.focus.completedEyebrow}</span>
          <h1>{copy.focus.completedTitle}</h1>
          <p>{copy.focus.completedDescription}</p>
          <div className="focus-complete__actions">
            <button type="button" onClick={session.replayDue}>
              {session.dueReplayCount > 0
                ? `${copy.focus.repeatDue} · ${session.dueReplayCount}`
                : copy.focus.repeatDueFallback}
            </button>
            <Link href="/cards">{copy.focus.returnToCards}</Link>
          </div>
        </section>
      </main>
    );
  }

  const ratingLabels = {
    hard: { label: copy.focus.hard, hint: copy.focus.hardHint },
    normal: { label: copy.focus.normal, hint: copy.focus.normalHint },
    easy: { label: copy.focus.easy, hint: copy.focus.easyHint },
  };

  return (
    <main className="focus-session">
      <div className="focus-gradient" aria-hidden="true" />

      <header className="focus-header">
        <Link className="site-brand" href="/cards">
          {brand}
        </Link>
        <div className="focus-progress" aria-label={`${copy.focus.progress} ${currentPosition} ${copy.focus.of} ${session.totalCards}`}>
          <span>
            {copy.focus.progress} {currentPosition} {copy.focus.of} {session.totalCards}
          </span>
          <div
            aria-label={`${copy.focus.progress} ${currentPosition} ${copy.focus.of} ${session.totalCards}`}
            aria-valuemax={session.totalCards}
            aria-valuemin={0}
            aria-valuenow={session.completedUnique}
            role="progressbar"
          >
            <i style={{ width: `${session.progressPercent}%` }} />
          </div>
        </div>
        <Link className="focus-exit" href="/cards">
          {copy.focus.exit}
        </Link>
      </header>

      <section
        className={`focus-card-stack ${session.isFlipped ? "focus-card-stack--answer" : ""} ${
          isAdvancing ? "focus-card-stack--advancing" : ""
        }`}
        aria-live="polite"
      >
        <div className="focus-card-stack__edge focus-card-stack__edge--back" aria-hidden="true" />
        <div className="focus-card-stack__edge focus-card-stack__edge--middle" aria-hidden="true" />

        {/* The stage is keyed and owns enter/exit animations; the article owns
            only the flip transform. Mixing them on one element made the enter
            animation replay whenever the card was flipped back. */}
        <div
          className={`focus-card-stage ${isAdvancing ? "focus-card-stage--advancing" : ""}`}
          key={session.currentCard.id}
        >
          <article
            className={`focus-card ${session.isFlipped ? "focus-card--answer" : ""}`}
            onClick={(event) => {
              if (isAdvancing) return;
              // Clicking the card flips it both ways, but let inner controls
              // (reveal / rating buttons) handle their own clicks.
              if (event.target instanceof Element && event.target.closest("a, button, kbd")) {
                return;
              }
              session.setIsFlipped((flipped) => !flipped);
            }}
          >
            <div className="focus-card__inner">
              <div className="focus-card__face focus-card__face--front" aria-hidden={session.isFlipped}>
                <div className="focus-card__meta">
                  <span>{session.currentCard.type}</span>
                  {session.currentCard.createdByAi ? (
                    <b className="card-ai-badge" title={copy.focus.aiBadgeTitle}>
                      AI
                    </b>
                  ) : null}
                  <em>{session.currentCard.source}</em>
                </div>

                <div className="focus-card__content">
                  <h1>{session.currentCard.front}</h1>
                </div>

                <button
                  className="focus-reveal"
                  disabled={session.isFlipped || isAdvancing}
                  type="button"
                  onClick={() => session.setIsFlipped(true)}
                >
                  {copy.focus.showAnswer}
                </button>
              </div>

              <div className="focus-card__face focus-card__face--back" aria-hidden={!session.isFlipped}>
                <div className="focus-card__meta">
                  <span>{session.currentCard.type}</span>
                  {session.currentCard.createdByAi ? (
                    <b className="card-ai-badge" title={copy.focus.aiBadgeTitle}>
                      AI
                    </b>
                  ) : null}
                  <em>{session.currentCard.source}</em>
                </div>

                <div className="focus-card__content">
                  <span>{copy.focus.answerPrompt}</span>
                  <h1>{session.currentCard.back}</h1>
                </div>

                <div className="focus-rating">
                  <span>{copy.focus.ratePrompt}</span>
                  {rateError ? (
                    <p className="focus-rating__status focus-rating__status--error" role="alert">
                      {rateError}
                    </p>
                  ) : null}
                  {isAdvancing ? (
                    <p className="focus-rating__status" role="status">
                      {copy.focus.saving}
                    </p>
                  ) : null}
                  <div>
                    {ratings.map(({ key, shortcut }) => (
                      <button
                        className={`focus-rating__button focus-rating__button--${key}`}
                        disabled={!session.isFlipped || isAdvancing}
                        key={key}
                        type="button"
                        onClick={() => advanceCard(key)}
                      >
                        <kbd>{shortcut}</kbd>
                        <strong>{ratingLabels[key].label}</strong>
                        <small>{ratingLabels[key].hint}</small>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </article>
        </div>
      </section>

      <footer className="focus-footer">{copy.focus.keyboardHint}</footer>
    </main>
  );
}
