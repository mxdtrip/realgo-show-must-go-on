import { useState } from "react";
import { createRoot } from "react-dom/client";

import type {
  DetectedSubmission,
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

function Preview() {
  const [choice, setChoice] = useState<StateChoice>("form");
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
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "center" }}>
      {showControls && (
        <Toolbar
          choice={choice}
          onChoice={setChoice}
          failNext={failNext}
          onFailNext={setFailNext}
        />
      )}
      {/* key forces a fresh PopupApp when switching states */}
      <PopupApp
        key={`${choice}-${failNext}`}
        submission={submission}
        onSave={onSave}
        onClose={() => alert("Скрыть (в расширении — прячет оверлей до след. задачи)")}
        onReview={() => alert("К повторению (в расширении — открывает /cards)")}
      />
    </div>
  );
}

function Toolbar(props: {
  choice: StateChoice;
  onChoice: (c: StateChoice) => void;
  failNext: boolean;
  onFailNext: (v: boolean) => void;
}) {
  const tabs: { id: StateChoice; label: string }[] = [
    { id: "form", label: "Форма" },
    { id: "loading", label: "Загрузка" },
    { id: "notask", label: "Нет задачи" },
  ];
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        alignItems: "center",
        flexWrap: "wrap",
        justifyContent: "center",
        color: "#7d8590",
        fontSize: 12,
      }}
    >
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
  );
}

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
