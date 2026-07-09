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
 */
export function streamAssistantHintViaBackground(
  payload: AssistantHintPayload,
  onDelta: (text: string) => void
): Promise<AssistantHintResult> {
  return new Promise((resolve, reject) => {
    const port = chrome.runtime.connect({ name: ASSISTANT_HINT_STREAM_PORT });
    let settled = false;

    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };

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

    port.postMessage({ type: "start", payload });
  });
}
