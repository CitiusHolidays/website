const CHAT_ID = "citius-public-chat";

function parseStreamEvent(eventText) {
  const data = eventText
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart())
    .join("\n");
  if (!data || data === "[DONE]") {
    return null;
  }

  try {
    return JSON.parse(data);
  } catch (parseError) {
    console.error("Unable to parse chat stream event:", parseError);
    return null;
  }
}

/**
 * @param {object} options
 * @param {Array} options.messages
 * @param {object} options.userMessage
 * @param {string} options.assistantId
 * @param {AbortSignal} options.signal
 * @param {(text: string) => void} options.onTextDelta
 * @param {(message: string) => void} options.onStreamError
 * @returns {Promise<{ streamedVisibleText: boolean; streamHadError: boolean }>}
 */
export async function streamChatResponse({
  messages,
  userMessage,
  assistantId,
  signal,
  onTextDelta,
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
    const errorText = await response.text();
    onStreamError(errorText || "Failed to fetch the chat response.");
    return { streamedVisibleText: false, streamHadError: true };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let assistantText = "";
  let streamedVisibleText = false;
  let streamHadError = false;

  const handleEvent = (eventText) => {
    const event = parseStreamEvent(eventText);
    if (!event) {
      return;
    }

    if (event.type === "text-delta" && typeof event.delta === "string") {
      assistantText += event.delta;
      const visibleText = assistantText.trimStart();
      if (visibleText.trim()) {
        streamedVisibleText = true;
        onTextDelta(visibleText);
      }
      return;
    }

    if (event.type === "error") {
      streamHadError = true;
      onStreamError(
        event.errorText ||
          event.message ||
          "Citius Concierge is temporarily at model capacity. Please try again."
      );
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() || "";
    for (const eventText of events) {
      handleEvent(eventText);
    }
  }

  buffer += decoder.decode();
  if (buffer.trim()) {
    handleEvent(buffer);
  }

  return { streamedVisibleText, streamHadError };
}
