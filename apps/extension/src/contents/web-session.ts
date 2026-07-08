import type { PlasmoCSConfig } from "plasmo";

/**
 * Session bridge: watches the realgo.dev web app's localStorage tokens
 * (`realgo:auth:access:v1` / `realgo:auth:refresh:v1`, see
 * apps/web/app/_api/tokens.ts) and mirrors them into the extension's own
 * chrome.storage session (see lib/auth.ts syncWebSession), so logging into
 * the web cabinet also logs in the extension — no separate options-page login.
 *
 * localStorage lives on the page origin and is readable from a content
 * script (isolated JS world, shared DOM/storage), no extra host permission
 * beyond the existing content-script match. The web app dispatches a custom
 * `realgo:auth-changed` window event on every login/logout (same JS realm as
 * the page, but DOM event dispatch is visible across isolated worlds), and
 * `storage` covers the case where the token changed in another tab.
 */
export const config: PlasmoCSConfig = {
  matches: ["https://realgo.dev/*", "http://localhost:3000/*"],
  run_at: "document_idle",
};

const ACCESS_KEY = "realgo:auth:access:v1";
const REFRESH_KEY = "realgo:auth:refresh:v1";
const CHANGED_EVENT = "realgo:auth-changed";

function syncSession() {
  const accessToken = window.localStorage.getItem(ACCESS_KEY);
  const refreshToken = window.localStorage.getItem(REFRESH_KEY);
  chrome.runtime
    .sendMessage({ type: "REALGO_SYNC_WEB_SESSION", accessToken, refreshToken })
    .catch(() => {
      /* background worker may be asleep on first install; next event retries */
    });
}

syncSession();
window.addEventListener(CHANGED_EVENT, syncSession);
window.addEventListener("storage", (event) => {
  if (event.key === ACCESS_KEY || event.key === REFRESH_KEY) syncSession();
});
