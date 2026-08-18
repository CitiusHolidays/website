import {
  applyClientAiStreamEvent,
  consumeUiMessageSse,
  createClientAiMessage,
} from "@/lib/ai/uiMessageStream";
import { formatConciergeResponseError } from "@/lib/userFacingErrors";

const CHAT_ID = "citius-public-chat";

export async function chatResponseErrorMessage(response) {
  try {
    await response.body?.cancel();
  } catch {
    // The response status still owns the stable user-facing recovery message.
  }
  return formatConciergeResponseError(response.status);
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
