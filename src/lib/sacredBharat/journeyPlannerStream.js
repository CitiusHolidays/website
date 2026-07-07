/**
 * @param {object} options
 * @param {string} options.focusTempleId
 * @param {string} [options.trailSlug]
 * @param {string[]} options.visitedTempleIds
 * @param {string[]} [options.wishlistTrailSlugs]
 * @param {AbortSignal} options.signal
 * @param {(text: string) => void} options.onTextDelta
 * @param {(message: string) => void} options.onStreamError
 */
export async function streamJourneyPlannerResponse({
  focusTempleId,
  trailSlug,
  visitedTempleIds,
  wishlistTrailSlugs,
  signal,
  onTextDelta,
  onStreamError,
}) {
  const response = await fetch("/api/sacred-bharat/journey-planner", {
    body: JSON.stringify({
      focusTempleId,
      trailSlug,
      visitedTempleIds,
      wishlistTrailSlugs,
    }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
    signal,
  });

  if (!(response.ok && response.body)) {
    const errorText = await response.text();
    onStreamError(errorText || "Failed to generate your journey plan.");
    return { streamedVisibleText: false, streamHadError: true };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let assistantText = "";
  let streamedVisibleText = false;
  let streamHadError = false;

  const handleEvent = (eventText) => {
    const data = eventText
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    if (!data || data === "[DONE]") {
      return;
    }

    let event;
    try {
      event = JSON.parse(data);
    } catch {
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
        event.errorText || event.message || "Journey planner is temporarily unavailable."
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
