import type { PlasmoCSConfig } from "plasmo";

/**
 * Session bridge: watches the realgo.dev web app's localStorage tokens
 * (`realgo:auth:access:v1` / `realgo:auth:refresh:v1`, see
 * apps/web/app/_api/tokens.ts) and asks the backend for an independent
 * extension device session (see lib/auth.ts syncWebSession), so logging into
 * the web cabinet also logs in the extension without sharing a rotating
 * refresh token or requiring a separate options-page login.
 *
 * localStorage lives on the page origin and is readable from a content
 * script (isolated JS world, shared DOM/storage), no extra host permission
 * beyond the existing content-script match. The web app dispatches a custom
 * `realgo:auth-changed` window event on every login/logout (same JS realm as
 * the page, but DOM event dispatch is visible across isolated worlds), and
 * `storage` covers the case where the token changed in another tab.
 */
export const config: PlasmoCSConfig = {
  matches: [
    "https://realgo.dev/*",
    "http://localhost:3000/*",
    "http://localhost:8080/*",
    "http://127.0.0.1:3000/*",
    "http://127.0.0.1:8080/*",
  ],
  run_at: "document_idle",
};

const ACCESS_KEY = "realgo:auth:access:v1";
const REFRESH_KEY = "realgo:auth:refresh:v1";
const CHANGED_EVENT = "realgo:auth-changed";

function syncSession() {
  let accessToken: string | null;
  let refreshToken: string | null;
  try {
    accessToken = window.localStorage.getItem(ACCESS_KEY);
    refreshToken = window.localStorage.getItem(REFRESH_KEY);
  } catch (error) {
    // Storage can throw synchronously in locked-down/private contexts. Keep
    // the content script alive so later auth/storage events can retry instead
    // of aborting before the listeners below are registered.
    console.error("[realgo] web-session: localStorage unavailable", error);
    return;
  }
  console.log("[realgo] web-session: syncing", {
    hasAccess: Boolean(accessToken),
    hasRefresh: Boolean(refreshToken),
  });
  chrome.runtime
    .sendMessage({ type: "REALGO_SYNC_WEB_SESSION", accessToken, refreshToken })
    .then((res) => console.log("[realgo] web-session: background ack", res))
    .catch((err) => console.error("[realgo] web-session: sendMessage failed", err));
}

console.log("[realgo] web-session content script loaded on", location.href);
syncSession();
window.addEventListener(CHANGED_EVENT, syncSession);
window.addEventListener("storage", (event) => {
  if (event.key === ACCESS_KEY || event.key === REFRESH_KEY) syncSession();
});
