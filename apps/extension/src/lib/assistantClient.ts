import type {
  AssistantHintPayload,
  AssistantHintResponse,
  AssistantHintResult,
} from "./types";

export async function fetchAssistantHintViaBackground(
  payload: AssistantHintPayload
): Promise<AssistantHintResult> {
  const res: AssistantHintResponse | undefined = await chrome.runtime.sendMessage({
    type: "REALGO_GET_ASSISTANT_HINT",
    payload,
  });
  if (!res?.ok || !res.result) {
    throw new Error(res?.error ?? "AI-помощник сейчас недоступен.");
  }
  return res.result;
}
