"use client";

import { useEffect, useState } from "react";

import {
  getExtensionStatus,
  type ExtensionStatusResponse,
} from "../../../_api/extension";
import { ApiError } from "../../../_api/types";
import { CabinetPanel, StatusPill } from "../../_components";

type Tone = "default" | "accent" | "success" | "warning" | "danger";
type LoadState = "loading" | "loaded" | "error";

type ExtensionCopy = Readonly<{
  eyebrow: string;
  title: string;
  description: string;
  statusEyebrow: string;
  statusTitle: string;
  platformsUnit: string;
  metaLastSync: string;
  metaEventsToday: string;
  stateLive: string;
  stateIdle: string;
  justNow: string;
  agoMinutes: string;
  agoHours: string;
  agoDays: string;
  statusDescription: string;
  statusEmpty: string;
  eventsEyebrow: string;
  eventsTitle: string;
  eventsUnit: string;
  eventsEmpty: string;
  listening: string;
  loading: string;
  errorTitle: string;
  retry: string;
  eventTypes: readonly (readonly [string, string, string])[];
}>;

/** Платформа активна, если расширение синхронизировалось за последние сутки. */
const LIVE_WINDOW_MS = 24 * 60 * 60 * 1000;

const platformNames: Record<string, string> = {
  leetcode: "LeetCode",
  geeksforgeeks: "GeeksforGeeks",
  hackerrank: "HackerRank",
  codeforces: "Codeforces",
  generic: "Generic",
  // Legacy source value from the pre-fork extension MVP (see project memory);
  // kept so old event rows still render with correct casing.
  neetcode: "NeetCode",
};

function platformName(source: string): string {
  return platformNames[source] ?? source.charAt(0).toUpperCase() + source.slice(1);
}

function relativeAgo(value: string, copy: ExtensionCopy): string {
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "";
  const diffMs = Math.max(0, Date.now() - then);
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return copy.justNow;
  if (minutes < 60) return `${minutes} ${copy.agoMinutes}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${copy.agoHours}`;
  return `${Math.floor(hours / 24)} ${copy.agoDays}`;
}

const eventTimeFormatter = new Intl.DateTimeFormat("ru-RU", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function isToday(value: string): boolean {
  const date = new Date(value);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

/** Статус расширения на живых данных GET /me/extension/status:
    платформы с последним синком и лента последних событий. */
export function ExtensionStatusClient({ copy }: Readonly<{ copy: ExtensionCopy }>) {
  const [data, setData] = useState<ExtensionStatusResponse | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [error, setError] = useState("");
  const [reloadVersion, setReloadVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoadState("loading");
    setError("");

    getExtensionStatus(controller.signal)
      .then((response) => {
        setData(response);
        setLoadState("loaded");
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        setData(null);
        setError(e instanceof ApiError ? e.message : copy.errorTitle);
        setLoadState("error");
      });

    return () => controller.abort();
  }, [copy.errorTitle, reloadVersion]);

  const eventMeta = new Map(copy.eventTypes.map(([key, label, tone]) => [key, { label, tone }]));
  const platforms = data?.platforms ?? [];
  const events = data?.recentEvents ?? [];
  const lastSyncAt = platforms.reduce<string | null>(
    (latest, platform) =>
      latest === null || platform.lastSyncAt > latest ? platform.lastSyncAt : latest,
    null,
  );
  const eventsToday = events.filter((event) => isToday(event.occurredAt)).length;

  return (
    <main className="cabinet-page">
      <section className="cabinet-page-head">
        <div>
          <span className="cabinet-eyebrow">{copy.eyebrow}</span>
          <h1>{copy.title}</h1>
          <p>{copy.description}</p>
        </div>
      </section>

      {loadState === "loading" ? (
        <CabinetPanel title={copy.loading} padded>
          <p role="status" aria-live="polite">
            {copy.loading}
          </p>
        </CabinetPanel>
      ) : null}

      {loadState === "error" ? (
        <CabinetPanel title={copy.errorTitle} padded>
          <p role="alert">{error || copy.errorTitle}</p>
          <button
            className="review-action review-action--ghost"
            type="button"
            onClick={() => setReloadVersion((version) => version + 1)}
          >
            {copy.retry}
          </button>
        </CabinetPanel>
      ) : null}

      {loadState === "loaded" ? (
        <div className="cabinet-grid">
          <CabinetPanel
            eyebrow={copy.statusEyebrow}
            title={copy.statusTitle}
            meta={
              <span className="cabinet-panel__meta">
                {platforms.length} {copy.platformsUnit}
              </span>
            }
          >
            <div className="extension-status">
              {platforms.map((platform) => {
                const live =
                  Date.now() - new Date(platform.lastSyncAt).getTime() < LIVE_WINDOW_MS;
                return (
                  <div className="ext-platform" key={platform.source}>
                    <span
                      className={live ? "live-dot" : "live-dot live-dot--idle"}
                      aria-hidden="true"
                    />
                    <strong>{platformName(platform.source)}</strong>
                    <StatusPill tone={(live ? "success" : "default") as Tone}>
                      {live ? copy.stateLive : copy.stateIdle}
                    </StatusPill>
                  </div>
                );
              })}
              {platforms.length === 0 ? (
                <p className="extension-status__note">{copy.statusEmpty}</p>
              ) : (
                <>
                  <div className="extension-meta">
                    {lastSyncAt ? (
                      <div>
                        <span>{copy.metaLastSync}</span>
                        <strong>{relativeAgo(lastSyncAt, copy)}</strong>
                      </div>
                    ) : null}
                    <div>
                      <span>{copy.metaEventsToday}</span>
                      <strong>{eventsToday}</strong>
                    </div>
                  </div>
                  <p className="extension-status__note">{copy.statusDescription}</p>
                </>
              )}
            </div>
          </CabinetPanel>

          <CabinetPanel
            eyebrow={copy.eventsEyebrow}
            title={copy.eventsTitle}
            meta={
              <span className="cabinet-panel__meta">
                {events.length} {copy.eventsUnit}
              </span>
            }
          >
            <div className="term-log">
              {events.map((event) => {
                const meta = eventMeta.get(event.event);
                return (
                  <div className="term-log__row" key={event.id}>
                    <span className="term-log__time">
                      {eventTimeFormatter.format(new Date(event.occurredAt))}
                    </span>
                    <span className="term-log__source">{event.source}</span>
                    <span className="term-log__title">{event.title}</span>
                    <span className={`term-log__event term-log__event--${meta?.tone ?? "default"}`}>
                      {meta?.label ?? event.event}
                    </span>
                  </div>
                );
              })}
              {events.length === 0 ? (
                <div className="term-log__row">
                  <span className="term-log__title">{copy.eventsEmpty}</span>
                </div>
              ) : null}
              <div className="term-log__listen">
                <i aria-hidden="true" />
                {copy.listening}
              </div>
            </div>
          </CabinetPanel>
        </div>
      ) : null}
    </main>
  );
}
