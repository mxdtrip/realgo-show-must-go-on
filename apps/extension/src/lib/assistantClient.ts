import {
  ASSISTANT_HINT_STREAM_PORT,
  type AssistantHintPayload,
  type AssistantHintResult,
  type AssistantHintStreamMessage,
} from "./types";

/**
 * Slightly above the backend's own Gemini call timeout (45s, see
 * services/api/internal/ai/gemini_provider.go requestTimeout), so a real
 * response always wins the race. This exists because a suspended MV3 service
 * worker could otherwise leave the port silent forever — which is exactly
 * what left the UI stuck on "думаю над следующей наводкой…" with the hint
 * buttons disabled before this timeout was added.
 */
const RESPONSE_TIMEOUT_MS = 50_000;

/**
 * Requests a hint over a long-lived port so the background worker can relay
 * the model's text as it's generated (`onDelta`, called once per fragment,
 * in order) instead of making the UI wait for the full reply.
 *
 * `signal` lets the caller cancel a request whose UI is gone — e.g. the
 * in-page assistant dock unmounts on SPA navigation to a new task, but
 * unmounting the React tree doesn't touch this port on its own: without a
 * way to disconnect it, the background worker (and the LLM call it made)
 * would run to completion for a reply nobody will ever see.
 */
export function streamAssistantHintViaBackground(
  payload: AssistantHintPayload,
  onDelta: (text: string) => void,
  signal?: AbortSignal
): Promise<AssistantHintResult> {
  return new Promise((resolve, reject) => {
    const port = chrome.runtime.connect({ name: ASSISTANT_HINT_STREAM_PORT });
    let settled = false;

    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      fn();
    };

    function onAbort() {
      settle(() => reject(new DOMException("The hint request was aborted.", "AbortError")));
      port.disconnect();
    }

    const timer = setTimeout(() => {
      settle(() => reject(new Error("AI-помощник не ответил вовремя. Попробуйте ещё раз.")));
      port.disconnect();
    }, RESPONSE_TIMEOUT_MS);

    port.onMessage.addListener((message: AssistantHintStreamMessage) => {
      if (message.type === "delta") {
        onDelta(message.text);
        return;
      }
      settle(() => {
        if (message.type === "done") resolve(message.result);
        else reject(new Error(message.error));
      });
      port.disconnect();
    });

    // Covers a service worker suspended/crashed mid-stream: without this, a
    // disconnect that never sent "done"/"error" would leave the promise
    // hanging until the timeout above, instead of failing immediately.
    port.onDisconnect.addListener(() => {
      settle(() => reject(new Error("AI-помощник сейчас недоступен.")));
    });

    if (signal) {
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener("abort", onAbort, { once: true });
    }

    port.postMessage({ type: "start", payload });
  });
}
