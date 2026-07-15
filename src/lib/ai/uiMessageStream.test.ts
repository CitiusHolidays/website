import { describe, expect, test } from "bun:test";
import {
  applyClientAiStreamEvent,
  consumeUiMessageSse,
  createClientAiMessage,
  markClientAiMessageTerminal,
} from "./uiMessageStream";

function sseResponse(events: unknown[], chunkAt = Number.POSITIVE_INFINITY) {
  const body = `${events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("")}data: [DONE]\n\n`;
  const encoded = new TextEncoder().encode(body);
  return new Response(
    new ReadableStream({
      start(controller) {
        for (let index = 0; index < encoded.length; index += chunkAt) {
          controller.enqueue(encoded.slice(index, Math.min(index + chunkAt, encoded.length)));
        }
        controller.close();
      },
    }),
    { headers: { "Content-Type": "text/event-stream" } }
  );
}

describe("client AI message stream", () => {
  test("preserves text, reasoning, tool, status, and stable part identifiers", () => {
    let message = createClientAiMessage("assistant-1");
    const events = [
      { messageId: "server-message", type: "start" },
      { type: "start-step" },
      { id: "reasoning-1", type: "reasoning-start" },
      { delta: "Checking destination fit", id: "reasoning-1", type: "reasoning-delta" },
      { id: "reasoning-1", type: "reasoning-end" },
      { toolCallId: "tool-1", toolName: "searchCitiusOfferings", type: "tool-input-start" },
      {
        input: { category: "mice" },
        toolCallId: "tool-1",
        toolName: "searchCitiusOfferings",
        type: "tool-input-available",
      },
      { output: { destinations: ["Goa"] }, toolCallId: "tool-1", type: "tool-output-available" },
      { id: "text-1", type: "text-start" },
      { delta: "Goa is a strong fit.", id: "text-1", type: "text-delta" },
    ];

    for (const event of events) {
      message = applyClientAiStreamEvent(message, event);
    }
    const textPart = message.parts.find((part) => part.type === "text");
    const textIdBeforeGrowth = textPart?.id;
    message = applyClientAiStreamEvent(message, {
      delta: " It has proven MICE inventory.",
      id: "text-1",
      type: "text-delta",
    });

    expect(message.id).toBe("server-message");
    expect(message.parts.map((part) => part.type)).toEqual(["status", "reasoning", "tool", "text"]);
    expect(message.parts.find((part) => part.type === "text")?.id).toBe(textIdBeforeGrowth);
    expect(message.parts.find((part) => part.type === "text")?.text).toBe(
      "Goa is a strong fit. It has proven MICE inventory."
    );
    expect(message.parts.find((part) => part.type === "tool")).toMatchObject({
      id: "tool-1",
      status: "output-available",
      toolName: "searchCitiusOfferings",
    });
  });

  test("distinguishes complete, cancelled, interrupted, and failed terminal states", () => {
    const generating = applyClientAiStreamEvent(createClientAiMessage("a"), {
      delta: "Partial",
      id: "text-1",
      type: "text-delta",
    });
    expect(
      applyClientAiStreamEvent(generating, { finishReason: "stop", type: "finish" }).terminalState
    ).toBe("complete");
    expect(markClientAiMessageTerminal(generating, "cancelled").terminalState).toBe("cancelled");
    expect(
      applyClientAiStreamEvent(generating, { reason: "timeout", type: "abort" }).terminalState
    ).toBe("interrupted");
    expect(
      applyClientAiStreamEvent(generating, { errorText: "Provider failed", type: "error" })
        .terminalState
    ).toBe("failed");
  });

  test("parses arbitrarily split SSE and persists partial terminal output", async () => {
    const updates: any[] = [];
    const response = sseResponse(
      [
        { messageId: "server-id", type: "start" },
        { id: "text-1", type: "text-start" },
        { delta: "Partial itinerary", id: "text-1", type: "text-delta" },
        { reason: "timeout", type: "abort" },
      ],
      7
    );
    const result = await consumeUiMessageSse({
      messageId: "client-id",
      onMessage: (message) => updates.push(message),
      response,
    });

    expect(result.message.id).toBe("server-id");
    expect(result.message.terminalState).toBe("interrupted");
    expect(result.streamedVisibleText).toBe(true);
    expect(updates.at(-1).parts.find((part: any) => part.type === "text").text).toBe(
      "Partial itinerary"
    );
  });

  test("marks a disconnected stream interrupted instead of complete", async () => {
    const response = sseResponse([
      { type: "start" },
      { id: "text-1", type: "text-start" },
      { delta: "Only the first half", id: "text-1", type: "text-delta" },
    ]);
    const result = await consumeUiMessageSse({ messageId: "a", response });
    expect(result.message.terminalState).toBe("interrupted");
    expect(result.message.parts.find((part) => part.type === "text")?.text).toBe(
      "Only the first half"
    );
  });
});
