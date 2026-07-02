import { useEffect, useState } from "react";

import { checkApiStatus } from "./lib/api";
import { AuthError, getCurrentUserEmail, login, logout } from "./lib/auth";
import {
  getApiBaseUrl,
  getWebBaseUrl,
  setApiBaseUrl,
  setWebBaseUrl,
} from "./lib/storage";
import { BrandMark } from "./popup/PopupApp";
import { POPUP_CSS } from "./popup/popup.styles";

type ConnStatus = "idle" | "checking" | "online" | "offline";

/**
 * Options page — account connection.
 *
 * Logs the extension into the existing realgo backend via email + password
 * (POST /api/v1/auth/login) and keeps the issued tokens in chrome.storage. The
 * access token is refreshed automatically on demand (see lib/api.ts).
 *
 * Visual system shared with the popup (see popup.styles.ts).
 */
function Options() {
  const [baseUrl, setBaseUrl] = useState("");
  const [baseSaved, setBaseSaved] = useState(false);

  const [webUrl, setWebUrl] = useState("");
  const [webSaved, setWebSaved] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [account, setAccount] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [conn, setConn] = useState<ConnStatus>("idle");

  useEffect(() => {
    getApiBaseUrl().then(setBaseUrl);
    getWebBaseUrl().then(setWebUrl);
    getCurrentUserEmail().then((e) => setAccount(e ?? null));
  }, []);

  async function handleSaveBaseUrl() {
    setError("");
    try {
      await ensureApiHostPermission(baseUrl);
      await setApiBaseUrl(baseUrl);
      setBaseSaved(true);
      setTimeout(() => setBaseSaved(false), 2000);
    } catch (err) {
      setError(err instanceof AuthError ? err.message : "Не удалось сохранить API URL.");
    }
  }

  async function handleSaveWebUrl() {
    await setWebBaseUrl(webUrl);
    setWebSaved(true);
    setTimeout(() => setWebSaved(false), 2000);
  }

  async function handleCheckConnection() {
    await setApiBaseUrl(baseUrl); // probe the value currently in the field
    setConn("checking");
    const ok = await checkApiStatus();
    setConn(ok ? "online" : "offline");
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setBusy(true);
    setError("");
    try {
      await ensureApiHostPermission(baseUrl);
      await setApiBaseUrl(baseUrl); // make sure login hits the configured API
      const user = await login(email, password);
      setAccount(user.email);
      setPassword("");
    } catch (err) {
      setError(err instanceof AuthError ? err.message : "Не удалось войти.");
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    setBusy(true);
    await logout();
    setAccount(null);
    setBusy(false);
  }

  return (
    <div className="realgo-popup realgo-popup--wide">
      <style>{POPUP_CSS}</style>

      <div className="realgo-header">
        <span className="realgo-brand">
          <BrandMark size={20} />
          ReAlgo
          <span className="realgo-path">~/ext/options</span>
        </span>
        <span className="realgo-header__sub">Настройки расширения</span>
      </div>

      <div className="realgo-body">
        <div className="realgo-field">
          <label className="realgo-field__label" htmlFor="realgo-base-url">
            API base URL
          </label>
          <div className="realgo-row">
            <input
              id="realgo-base-url"
              className="realgo-input"
              value={baseUrl}
              placeholder="http://localhost:8080"
              onChange={(e) => {
                setBaseUrl(e.target.value);
                setConn("idle");
              }}
            />
            <button
              type="button"
              className="realgo-btn realgo-btn--ghost"
              onClick={handleSaveBaseUrl}
            >
              {baseSaved ? "✓" : "OK"}
            </button>
            <button
              type="button"
              className="realgo-btn realgo-btn--ghost"
              disabled={conn === "checking"}
              onClick={handleCheckConnection}
            >
              {conn === "checking" ? "…" : "Проверить"}
            </button>
          </div>
          {conn === "online" && (
            <p className="realgo-account__note" style={{ color: "var(--success-fg)" }}>
              Бэкенд на связи
            </p>
          )}
          {conn === "offline" && (
            <p className="realgo-account__note" style={{ color: "var(--danger-fg)" }}>
              Бэкенд недоступен по этому адресу
            </p>
          )}
        </div>

        <div className="realgo-field">
          <label className="realgo-field__label" htmlFor="realgo-web-url">
            Web URL
          </label>
          <div className="realgo-row">
            <input
              id="realgo-web-url"
              className="realgo-input"
              value={webUrl}
              placeholder="http://localhost:3000"
              onChange={(e) => setWebUrl(e.target.value)}
            />
            <button
              type="button"
              className="realgo-btn realgo-btn--ghost"
              onClick={handleSaveWebUrl}
            >
              {webSaved ? "✓" : "OK"}
            </button>
          </div>
          <p className="realgo-account__note">
            Куда ведёт «К повторению» — раздел карточек кабинета.
          </p>
        </div>

        <hr className="realgo-divider" />

        {account === undefined ? null : account ? (
          <div className="realgo-account">
            <div>
              <div className="realgo-account__email">
                <span className="realgo-dot" aria-hidden="true" />
                {account}
              </div>
              <p className="realgo-account__note">Расширение подключено к realgo</p>
            </div>
            <button
              type="button"
              className="realgo-btn realgo-btn--danger"
              disabled={busy}
              onClick={handleLogout}
            >
              Выйти
            </button>
          </div>
        ) : (
          <form className="realgo-field" onSubmit={handleLogin}>
            <div className="realgo-form-title">Вход в realgo</div>
            <input
              className="realgo-input"
              type="email"
              autoComplete="username"
              value={email}
              placeholder="email@example.com"
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              className="realgo-input"
              type="password"
              autoComplete="current-password"
              value={password}
              placeholder="пароль"
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && (
              <div className="realgo-error" role="alert">
                <span className="realgo-error__text">{error}</span>
              </div>
            )}
            <button
              className="realgo-btn realgo-btn--primary realgo-btn--block"
              type="submit"
              disabled={busy || !email || !password}
            >
              {busy ? "Вход…" : "Войти"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function apiOriginPattern(baseUrl: string): string {
  const parsed = new URL(baseUrl);
  return `${parsed.protocol}//${parsed.host}/*`;
}

async function ensureApiHostPermission(baseUrl: string): Promise<void> {
  let origin: string;
  try {
    origin = apiOriginPattern(baseUrl);
  } catch {
    throw new AuthError("API base URL должен быть валидным URL.", 0, "invalid_api_url");
  }

  if (typeof chrome === "undefined" || !chrome.permissions?.contains || !chrome.permissions?.request) return;

  const permissions = { origins: [origin] };
  const alreadyGranted = await chrome.permissions.contains(permissions);
  if (alreadyGranted) return;

  const granted = await chrome.permissions.request(permissions);
  if (!granted) {
    throw new AuthError("Chrome не выдал доступ к API origin.", 0, "api_origin_denied");
  }
}

export default Options;
