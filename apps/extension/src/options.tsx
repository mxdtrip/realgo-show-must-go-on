import { useEffect, useState } from "react";

import { AuthError, getCurrentUserEmail, login, logout } from "./lib/auth";
import { getApiBaseUrl, setApiBaseUrl } from "./lib/storage";
import { BrandMark } from "./popup/PopupApp";
import { POPUP_CSS } from "./popup/popup.styles";

/**
 * Options page — account connection.
 *
 * Logs the extension into the existing Engram backend via email + password
 * (POST /api/v1/auth/login) and keeps the issued tokens in chrome.storage. The
 * access token is refreshed automatically on demand (see lib/api.ts).
 *
 * Visual system shared with the popup (see popup.styles.ts).
 */
function Options() {
  const [baseUrl, setBaseUrl] = useState("");
  const [baseSaved, setBaseSaved] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [account, setAccount] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getApiBaseUrl().then(setBaseUrl);
    getCurrentUserEmail().then((e) => setAccount(e ?? null));
  }, []);

  async function handleSaveBaseUrl() {
    await setApiBaseUrl(baseUrl);
    setBaseSaved(true);
    setTimeout(() => setBaseSaved(false), 2000);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setBusy(true);
    setError("");
    try {
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
    <div className="engram-popup engram-popup--wide">
      <style>{POPUP_CSS}</style>

      <div className="engram-header">
        <span className="engram-brand engram-brand--md">
          <BrandMark size={18} />
          Engram
        </span>
        <span className="engram-header__sub">Настройки расширения</span>
      </div>

      <div className="engram-body">
        <div className="engram-field">
          <label className="engram-field__label" htmlFor="engram-base-url">
            API base URL
          </label>
          <div className="engram-row">
            <input
              id="engram-base-url"
              className="engram-input"
              value={baseUrl}
              placeholder="http://localhost:8080"
              onChange={(e) => setBaseUrl(e.target.value)}
            />
            <button
              type="button"
              className="engram-btn engram-btn--ghost"
              onClick={handleSaveBaseUrl}
            >
              {baseSaved ? "✓" : "OK"}
            </button>
          </div>
        </div>

        <hr className="engram-divider" />

        {account === undefined ? null : account ? (
          <div className="engram-account">
            <div>
              <div className="engram-account__email">
                <span className="engram-dot" aria-hidden="true" />
                {account}
              </div>
              <p className="engram-account__note">Расширение подключено к Engram</p>
            </div>
            <button
              type="button"
              className="engram-btn engram-btn--danger"
              disabled={busy}
              onClick={handleLogout}
            >
              Выйти
            </button>
          </div>
        ) : (
          <form className="engram-field" onSubmit={handleLogin}>
            <div className="engram-field__label" style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
              Вход в Engram
            </div>
            <input
              className="engram-input"
              type="email"
              autoComplete="username"
              value={email}
              placeholder="email@example.com"
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              className="engram-input"
              type="password"
              autoComplete="current-password"
              value={password}
              placeholder="пароль"
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && (
              <div className="engram-error" role="alert">
                <span className="engram-error__text">{error}</span>
              </div>
            )}
            <button
              className="engram-btn engram-btn--primary engram-btn--block"
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

export default Options;
