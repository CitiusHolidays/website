import {
  applyClientAiStreamEvent,
  consumeUiMessageSse,
  createClientAiMessage,
} from "@/lib/ai/uiMessageStream";

const CHAT_ID = "citius-public-chat";

export async function chatResponseErrorMessage(response) {
  let raw = "";
  try {
    raw = await response.text();
    const parsed = raw ? JSON.parse(raw) : null;
    if (typeof parsed?.error === "string" && parsed.error.trim()) {
      return parsed.error.trim();
    }
  } catch {
    // Fall through to the plain response body or stable user-facing fallback.
  }
  if (raw.trim()) {
    return raw.trim();
  }
  if (response.status === 429) {
    return "Too many chat requests. Please try again shortly.";
  }
  return "Citius Concierge is temporarily unavailable. Please try again.";
}

/**
 * @param {object} options
 * @param {Array} options.messages
 * @param {object} options.userMessage
 * @param {string} options.assistantId
 * @param {AbortSignal} options.signal
 * @param {(message: import("@/lib/ai/uiMessageStream").ClientAiMessage) => void} options.onMessage
 * @param {(message: string) => void} options.onStreamError
 * @returns {Promise<import("@/lib/ai/uiMessageStream").ConsumeUiMessageSseResult>}
 */
export async function streamChatResponse({
  messages,
  userMessage,
  assistantId,
  signal,
  onMessage,
  onStreamError,
}) {
  const response = await fetch("/api/chat", {
    body: JSON.stringify({
      id: CHAT_ID,
      messageId: userMessage.id,
      messages,
      trigger: "submit-message",
    }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
    signal,
  });

  if (!(response.ok && response.body)) {
    const errorMessage = await chatResponseErrorMessage(response);
    onStreamError(errorMessage);
    const message = applyClientAiStreamEvent(createClientAiMessage(assistantId), {
      errorText: errorMessage,
      type: "error",
    });
    onMessage(message);
    return { message, streamedVisibleText: false, streamHadError: true };
  }
  return await consumeUiMessageSse({
    messageId: assistantId,
    onMessage,
    response,
    signal,
  });
}
