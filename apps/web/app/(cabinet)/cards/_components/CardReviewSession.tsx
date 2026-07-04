"use client";

import { useMemo } from "react";

import {
  getNotificationPermission,
  readNotificationSettings,
  showRealgoNotification,
} from "../../../_notifications/notifications";
import { ProgressBar, StatusPill } from "../../_components";
import { CardRatingControls } from "./CardRatingControls";
import { CardSessionSummary } from "./CardSessionSummary";
import { Flashcard } from "./Flashcard";
import {
  type ReviewCard,
  type ReviewRating,
  useCardReviewSession,
} from "../_state/useCardReviewSession";

type CardReviewSessionProps = {
  cards: readonly ReviewCard[];
  copy: {
    answerLabel: string;
    completedDescription: string;
    completedEyebrow: string;
    completedTitle: string;
    easyHint: string;
    emptyHistory: string;
    hardHint: string;
    hideAnswer: string;
    lastReviews: string;
    loading: string;
    nextReview: Record<ReviewRating, string>;
    normalHint: string;
    progress: string;
    questionLabel: string;
    ratePrompt: string;
    remaining: string;
    reset: string;
    showAnswer: string;
    startAgain: string;
    sessionCompleteBody: string;
    sessionCompleteTitle: string;
  };
  ratingLabels: Record<ReviewRating, string>;
};

export function CardReviewSession({ cards, copy, ratingLabels }: Readonly<CardReviewSessionProps>) {
  const session = useCardReviewSession(cards, copy.nextReview, () => {
    const settings = readNotificationSettings();
    if (!settings.enabled || !settings.cardReviewReminder || getNotificationPermission() !== "granted") return;
    void showRealgoNotification(copy.sessionCompleteTitle, {
      body: copy.sessionCompleteBody,
      data: { url: "/cards" },
      tag: "realgo-card-session-complete",
    });
  });
  const cardsById = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards]);

  if (!session.isReady) {
    return (
      <section className="card-session card-session--loading">
        <p>{copy.loading}</p>
      </section>
    );
  }

  if (session.isComplete || !session.currentCard) {
    return (
      <CardSessionSummary
        cardsById={cardsById}
        copy={copy}
        history={session.history}
        onReset={session.reset}
      />
    );
  }

  return (
    <section className="card-session">
      <div className="card-session__header">
        <div>
          <span className="cabinet-eyebrow">
            {session.completedUnique}/{session.totalCards} {copy.progress}
          </span>
          <ProgressBar value={session.progressPercent} label="Card review progress" />
        </div>
        <div className="card-session__status">
          <StatusPill tone="accent">
            {session.queue.length} {copy.remaining}
          </StatusPill>
          <button type="button" onClick={session.reset}>
            {copy.reset}
          </button>
        </div>
      </div>

      <div className="card-session__grid">
        <Flashcard
          card={session.currentCard}
          isFlipped={session.isFlipped}
          labels={{
            answer: copy.answerLabel,
            hideAnswer: copy.hideAnswer,
            question: copy.questionLabel,
            showAnswer: copy.showAnswer,
          }}
          onToggle={() => session.setIsFlipped((value) => !value)}
        />

        <aside className="card-session__side">
          <CardRatingControls
            disabled={!session.isFlipped}
            labels={{
              easy: ratingLabels.easy,
              easyHint: copy.easyHint,
              hard: ratingLabels.hard,
              hardHint: copy.hardHint,
              normal: ratingLabels.normal,
              normalHint: copy.normalHint,
              prompt: copy.ratePrompt,
            }}
            onRate={session.rate}
          />

          <div className="card-history card-history--compact">
            <h3>{copy.lastReviews}</h3>
            {session.history.length === 0 ? <p>{copy.emptyHistory}</p> : null}
            {session.history.slice(0, 4).map((item) => {
              const card = cardsById.get(item.cardId);
              return (
                <article key={`${item.cardId}-${item.reviewedAt}`}>
                  <strong>{card?.type ?? item.cardId}</strong>
                  <span>{ratingLabels[item.rating]}</span>
                  <em>{item.nextReview}</em>
                </article>
              );
            })}
          </div>
        </aside>
      </div>
    </section>
  );
}
