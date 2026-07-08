import type {
  AssistantHintPayload,
  AssistantHintResponse,
  AssistantHintResult,
} from "./types";

/**
 * Slightly above the backend's own Gemini call timeout (45s, see
 * services/api/internal/ai/gemini_provider.go requestTimeout), so a real
 * response always wins the race. This exists because chrome.runtime.sendMessage
 * has no built-in timeout: if the MV3 service worker gets suspended mid-request
 * and never calls sendResponse, the promise here would otherwise hang forever —
 * which is exactly what left the UI stuck on "думаю над следующей наводкой…"
 * with the hint buttons disabled.
 */
const RESPONSE_TIMEOUT_MS = 50_000;

export async function fetchAssistantHintViaBackground(
  payload: AssistantHintPayload
): Promise<AssistantHintResult> {
  const res = await Promise.race([
    chrome.runtime.sendMessage({ type: "REALGO_GET_ASSISTANT_HINT", payload }),
    timeout(),
  ]);
  const typed = res as AssistantHintResponse | undefined;
  if (!typed?.ok || !typed.result) {
    throw new Error(typed?.error ?? "AI-помощник сейчас недоступен.");
  }
  return typed.result;
}

function timeout(): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(
      () => reject(new Error("AI-помощник не ответил вовремя. Попробуйте ещё раз.")),
      RESPONSE_TIMEOUT_MS
    );
  });
}
