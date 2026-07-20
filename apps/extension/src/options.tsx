import { useEffect, useState } from "react";

import { AuthError, getCurrentUserEmail, login, logout } from "./lib/auth";
import { getApiBaseUrl, getWebBaseUrl, setWebBaseUrl } from "./lib/storage";
import { BrandMark } from "./popup/PopupApp";
import { POPUP_CSS } from "./popup/popup.styles";

/**
 * Options page — account connection.
 *
 * Logs the extension into the existing realgo backend via email + password
 * (POST /api/v1/auth/login) and keeps the issued tokens in chrome.storage. The
 * access token is refreshed automatically on demand (see lib/api.ts).
 *
 * The public release only ever talks to https://realgo.dev — there is no
 * optional_host_permissions in the store manifest to point the extension at
 * a different backend, so the API origin is shown read-only here rather
 * than as an editable field that would need broad host permissions to work.
 *
 * Visual system shared with the popup (see popup.styles.ts).
 */
function Options() {
  const [baseUrl, setBaseUrl] = useState("");

  const [webUrl, setWebUrl] = useState("");
  const [webSaved, setWebSaved] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [account, setAccount] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getApiBaseUrl().then(setBaseUrl);
    getWebBaseUrl().then(setWebUrl);
    getCurrentUserEmail().then((e) => setAccount(e ?? null));
  }, []);

  async function handleSaveWebUrl() {
    setError("");
    try {
      await setWebBaseUrl(webUrl);
      setWebSaved(true);
      setTimeout(() => setWebSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить Web URL.");
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setBusy(true);
    setError("");
    try {
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
    setAccount((await getCurrentUserEmail()) ?? null);
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
            API
          </label>
          <input id="realgo-base-url" className="realgo-input" value={baseUrl} disabled readOnly />
          <p className="realgo-account__note">Расширение работает только с сервером realgo.dev.</p>
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
              placeholder="https://realgo.dev"
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

        {error && (
          <div className="realgo-error" role="alert">
            <span className="realgo-error__text">{error}</span>
          </div>
        )}

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

export default Options;
