import { useEffect, useState } from "react";

import {
  getAccessToken,
  getApiBaseUrl,
  setAccessToken,
  setApiBaseUrl,
} from "./lib/storage";
import { POPUP_CSS } from "./popup/popup.styles";

/**
 * Options page — dev-mode authentication.
 *
 * TODO: replace this manual access-token field with a real login/refresh flow
 * against POST /api/v1/auth/login once the extension owns a proper auth UX.
 * For the MVP the developer pastes a short-lived Bearer access token here.
 */
function Options() {
  const [baseUrl, setBaseUrl] = useState("");
  const [token, setToken] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getApiBaseUrl().then(setBaseUrl);
    getAccessToken().then((t) => setToken(t ?? ""));
  }, []);

  async function handleSave() {
    await setApiBaseUrl(baseUrl);
    await setAccessToken(token);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="engram-popup" style={{ width: 420 }}>
      <style>{POPUP_CSS}</style>
      <div className="engram-brand">Engram</div>
      <div className="engram-saved-label" style={{ color: "var(--accent-bright)" }}>
        Настройки (dev)
      </div>

      <div className="engram-question">
        <label className="engram-question__label" htmlFor="engram-base-url">
          API base URL
        </label>
        <input
          id="engram-base-url"
          className="engram-input"
          value={baseUrl}
          placeholder="http://localhost:8080"
          onChange={(e) => setBaseUrl(e.target.value)}
        />
      </div>

      <div className="engram-question">
        <label className="engram-question__label" htmlFor="engram-token">
          Access token (Bearer)
        </label>
        <input
          id="engram-token"
          className="engram-input"
          type="password"
          value={token}
          placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…"
          onChange={(e) => setToken(e.target.value)}
        />
        <div className="engram-task-meta" style={{ marginTop: 6 }}>
          Временно: получите токен через POST /api/v1/auth/login и вставьте сюда.
        </div>
      </div>

      <button className="engram-save" onClick={handleSave}>
        {saved ? "Сохранено ✓" : "Сохранить"}
      </button>

      <style>{`
        .engram-input {
          width: 100%;
          margin-top: 8px;
          border: 1px solid var(--border);
          background: rgba(255,255,255,0.05);
          border-radius: 9px;
          color: var(--text);
          padding: 11px 13px;
          font-family: var(--font-mono);
          font-size: 12.5px;
        }
        .engram-input:focus {
          outline: none;
          border-color: var(--accent-line);
          box-shadow: 0 0 0 2px var(--accent-soft);
        }
      `}</style>
    </div>
  );
}

export default Options;
