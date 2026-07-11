import { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";

import type {
  DetectedSubmission,
  ExtensionEventResult,
  ProblemCardsResult,
  SubmissionPayload,
} from "../src/lib/types";
import { MOCK_SUBMISSION } from "../src/popup/mock";
import { PopupApp } from "../src/popup/PopupApp";

/**
 * Standalone preview harness so the popup UI can be reviewed by URL (Docker).
 * It renders the exact same PopupApp component used by the extension, driven by
 * mock data, with a small toolbar to exercise every popup state.
 */
type StateChoice = "form" | "loading" | "notask";

/**
 * Cards-poll scenarios mirror the real endpoint's behaviours:
 *   generating → "generating" twice, then "ready" (happy path);
 *   none       → "none" every tick (unrecognised task / quota exhausted);
 *   off        → null every tick = endpoint absent (404), block never shows.
 */
type CardsChoice = "generating" | "none" | "off";

const MOCK_EVENT_RESULT: ExtensionEventResult = {
  accepted: true,
  duplicate: false,
  problemId: 42,
  status: "recorded",
  nextReviewAt: null,
};

function Preview() {
  const [choice, setChoice] = useState<StateChoice>("form");
  const [cards, setCards] = useState<CardsChoice>("generating");
  const [failNext, setFailNext] = useState(false);
  const showControls =
    new URLSearchParams(window.location.search).get("controls") !== "0";

  const submission: DetectedSubmission | null | undefined =
    choice === "form" ? MOCK_SUBMISSION : choice === "loading" ? undefined : null;

  async function onSave(_payload: SubmissionPayload) {
    await delay(700);
    if (failNext) {
      throw new Error("Ошибка сервера 500");
    }
    return MOCK_EVENT_RESULT;
  }

  // A fresh fetcher (and its tick counter) per scenario switch; the key below
  // also remounts PopupApp so every run starts from the rating form.
  const fetchCards = useMemo(() => {
    let ticks = 0;
    return async (_problemId: number): Promise<ProblemCardsResult | null> => {
      await delay(400);
      ticks += 1;
      if (cards === "off") return null;
      if (cards === "none") return { status: "none", cardsCount: 0 };
      return ticks <= 2
        ? { status: "generating", cardsCount: 0 }
        : { status: "ready", cardsCount: 3 };
    };
  }, [cards]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "center" }}>
      {showControls && (
        <Toolbar
          choice={choice}
          onChoice={setChoice}
          cards={cards}
          onCards={setCards}
          failNext={failNext}
          onFailNext={setFailNext}
        />
      )}
      {/* key forces a fresh PopupApp when switching states */}
      <PopupApp
        key={`${choice}-${cards}-${failNext}`}
        submission={submission}
        onSave={onSave}
        onFetchCards={fetchCards}
        onClose={() => alert("Свернуть (в расширении — прячет оверлей до след. задачи)")}
        onReview={() => alert("К повторению (в расширении — открывает /cards)")}
      />
    </div>
  );
}

function Toolbar(props: {
  choice: StateChoice;
  onChoice: (c: StateChoice) => void;
  cards: CardsChoice;
  onCards: (c: CardsChoice) => void;
  failNext: boolean;
  onFailNext: (v: boolean) => void;
}) {
  const tabs: { id: StateChoice; label: string }[] = [
    { id: "form", label: "Форма" },
    { id: "loading", label: "Загрузка" },
    { id: "notask", label: "Нет задачи" },
  ];
  const cardTabs: { id: CardsChoice; label: string }[] = [
    { id: "generating", label: "Карточки: генерация → готовы" },
    { id: "none", label: "Карточки: none" },
    { id: "off", label: "Карточки: эндпоинта нет (404)" },
  ];
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        alignItems: "center",
        color: "#7d8590",
        fontSize: 12,
      }}
    >
      <div style={rowStyle}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => props.onChoice(t.id)}
            style={tabStyle(props.choice === t.id)}
          >
            {t.label}
          </button>
        ))}
        <label style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={props.failNext}
            onChange={(e) => props.onFailNext(e.target.checked)}
          />
          Эмулировать ошибку при сохранении
        </label>
      </div>
      <div style={rowStyle}>
        {cardTabs.map((t) => (
          <button
            key={t.id}
            onClick={() => props.onCards(t.id)}
            style={tabStyle(props.cards === t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const rowStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "center",
  flexWrap: "wrap",
  justifyContent: "center",
};

function tabStyle(active: boolean): React.CSSProperties {
  return {
    border: `1px solid ${active ? "rgba(56,139,253,0.4)" : "#30363d"}`,
    background: active ? "rgba(56,139,253,0.15)" : "transparent",
    color: active ? "#58a6ff" : "#7d8590",
    borderRadius: 8,
    padding: "6px 12px",
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: 12,
  };
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

createRoot(document.getElementById("root")!).render(<Preview />);
