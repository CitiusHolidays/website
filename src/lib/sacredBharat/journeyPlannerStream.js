import {
  applyClientAiStreamEvent,
  consumeUiMessageSse,
  createClientAiMessage,
} from "@/lib/ai/uiMessageStream";

/**
 * @param {object} options
 * @param {string} options.focusTempleId
 * @param {string} [options.trailSlug]
 * @param {string[]} options.visitedTempleIds
 * @param {string[]} [options.wishlistTrailSlugs]
 * @param {AbortSignal} options.signal
 * @param {(message: import("@/lib/ai/uiMessageStream").ClientAiMessage) => void} options.onMessage
 * @param {(message: string) => void} options.onStreamError
 */
export async function streamJourneyPlannerResponse({
  focusTempleId,
  trailSlug,
  visitedTempleIds,
  wishlistTrailSlugs,
  signal,
  onMessage,
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
    const errorMessage = errorText || "Failed to generate your journey plan.";
    onStreamError(errorMessage);
    const message = applyClientAiStreamEvent(createClientAiMessage("journey-planner"), {
      errorText: errorMessage,
      type: "error",
    });
    onMessage(message);
    return { message, streamedVisibleText: false, streamHadError: true };
  }
  return await consumeUiMessageSse({
    messageId: `journey-planner-${Date.now()}`,
    onMessage,
    response,
    signal,
  });
}
