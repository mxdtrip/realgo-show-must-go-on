"use client";

import Link from "next/link";
import { useCallback, useEffect } from "react";

import {
  getNotificationPermission,
  readNotificationSettings,
  showEngramNotification,
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
    returnToCards: string;
    showAnswer: string;
  };
};

type FocusCardReviewSessionProps = {
  brand: string;
  cards: readonly ReviewCard[];
  copy: FocusCopy;
};

const ratings = [
  { key: "easy", shortcut: "1" },
  { key: "normal", shortcut: "2" },
  { key: "hard", shortcut: "3" },
] as const;

export function FocusCardReviewSession({ brand, cards, copy }: Readonly<FocusCardReviewSessionProps>) {
  const notifyComplete = useCallback(() => {
    const settings = readNotificationSettings();
    if (!settings.enabled || !settings.cardReviewReminder || getNotificationPermission() !== "granted") return;
    void showEngramNotification(copy.sessionCompleteTitle, {
      body: copy.sessionCompleteBody,
      data: { url: "/cards" },
      tag: "engram-card-session-complete",
    });
  }, [copy.sessionCompleteBody, copy.sessionCompleteTitle]);

  const session = useCardReviewSession(cards, copy.nextReview, notifyComplete);
  const currentPosition = Math.min(session.completedUnique + 1, session.totalCards);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.target instanceof Element &&
        event.target.closest("a, button, input, textarea, select, [contenteditable='true']")
      ) {
        return;
      }

      if ((event.code === "Space" || event.code === "Enter") && !session.isFlipped) {
        event.preventDefault();
        session.setIsFlipped(true);
        return;
      }

      if (!session.isFlipped) return;
      if (event.key === "1") session.rate("easy");
      if (event.key === "2") session.rate("normal");
      if (event.key === "3") session.rate("hard");
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [session]);

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
          <Link href="/cards">{copy.focus.returnToCards}</Link>
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

      <section className={`focus-card ${session.isFlipped ? "focus-card--answer" : ""}`} aria-live="polite">
        <div className="focus-card__meta">
          <span>{session.currentCard.type}</span>
          <em>{session.currentCard.source}</em>
        </div>

        <div className="focus-card__content">
          {session.isFlipped ? <span>{copy.focus.answerPrompt}</span> : null}
          <h1>{session.isFlipped ? session.currentCard.back : session.currentCard.front}</h1>
        </div>

        {!session.isFlipped ? (
          <button className="focus-reveal" type="button" onClick={() => session.setIsFlipped(true)}>
            {copy.focus.showAnswer}
          </button>
        ) : (
          <div className="focus-rating">
            <span>{copy.focus.ratePrompt}</span>
            <div>
              {ratings.map(({ key, shortcut }) => (
                <button className={`focus-rating__button focus-rating__button--${key}`} key={key} type="button" onClick={() => session.rate(key)}>
                  <kbd>{shortcut}</kbd>
                  <strong>{ratingLabels[key].label}</strong>
                  <small>{ratingLabels[key].hint}</small>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <footer className="focus-footer">{copy.focus.keyboardHint}</footer>
    </main>
  );
}
