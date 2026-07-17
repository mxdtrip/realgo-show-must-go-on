"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  getReviewQueue,
  rateReview,
  type ReviewQueueItem,
  type ReviewRating,
} from "../../../_api/reviews";
import { ApiError } from "../../../_api/types";
import { CabinetPanel } from "../../_components";

type QueueCopy = Readonly<{
  eyebrow: string;
  title: string;
  loading: string;
  empty: string;
  error: string;
  retry: string;
  openProblem: string;
  openCards: string;
  openPattern: string;
  ratePrompt: string;
  saving: string;
  saveError: string;
  ratings: Readonly<Record<ReviewRating, string>>;
}>;

export function ReviewQueueClient({ copy }: Readonly<{ copy: QueueCopy }>) {
  const [items, setItems] = useState<ReviewQueueItem[]>([]);
  const [state, setState] = useState<"loading" | "loaded" | "error">("loading");
  const [error, setError] = useState("");
  const [ratingID, setRatingID] = useState<string | null>(null);
  const [reloadVersion, setReloadVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState("loading");
    setError("");
    getReviewQueue(controller.signal)
      .then((response) => {
        setItems(response.data);
        setState("loaded");
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setError(reason instanceof ApiError ? reason.message : copy.error);
        setState("error");
      });
    return () => controller.abort();
  }, [copy.error, reloadVersion]);

  const submitRating = async (item: ReviewQueueItem, rating: ReviewRating) => {
    const id = String(item.id);
    if (ratingID) return;
    setRatingID(id);
    setError("");
    try {
      await rateReview(item.id, rating);
      setItems((current) => current.filter((candidate) => String(candidate.id) !== id));
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : copy.saveError);
    } finally {
      setRatingID(null);
    }
  };

  return (
    <CabinetPanel
      eyebrow={copy.eyebrow}
      title={copy.title}
      meta={<span className="cabinet-panel__meta">{state === "loaded" ? items.length : "…"}</span>}
    >
      <div className="review-queue">
        {state === "loading" ? <p role="status">{copy.loading}</p> : null}
        {state === "error" ? (
          <p role="alert">
            {error || copy.error}{" "}
            <button type="button" onClick={() => setReloadVersion((value) => value + 1)}>
              {copy.retry}
            </button>
          </p>
        ) : null}
        {state === "loaded" && items.length === 0 ? <p>{copy.empty}</p> : null}
        {state === "loaded"
          ? items.map((item) => {
              const pending = ratingID === String(item.id);
              const patternHref = item.patternCode
                ? `/patterns/${encodeURIComponent(item.patternCode)}/session`
                : "/patterns";
              return (
                <article className="review-queue__item" key={String(item.id)}>
                  <div>
                    <span>{item.typeLabel}</span>
                    <strong>{item.title}</strong>
                    <small>{item.meta}</small>
                  </div>
                  <div className="review-queue__actions">
                    {item.entityType === "card" ? (
                      <Link href="/cards/session">{copy.openCards}</Link>
                    ) : item.entityType === "pattern" ? (
                      <Link href={patternHref}>{copy.openPattern}</Link>
                    ) : item.entityUrl ? (
                      <a href={item.entityUrl} rel="noreferrer" target="_blank">
                        {copy.openProblem}
                      </a>
                    ) : null}
                    {item.entityType !== "card" ? (
                      <fieldset disabled={ratingID !== null}>
                        <legend>{pending ? copy.saving : copy.ratePrompt}</legend>
                        {(["hard", "normal", "easy"] as const).map((rating) => (
                          <button key={rating} type="button" onClick={() => void submitRating(item, rating)}>
                            {copy.ratings[rating]}
                          </button>
                        ))}
                      </fieldset>
                    ) : null}
                  </div>
                </article>
              );
            })
          : null}
        {error && state === "loaded" ? <p className="review-queue__error" role="alert">{error}</p> : null}
      </div>
    </CabinetPanel>
  );
}
