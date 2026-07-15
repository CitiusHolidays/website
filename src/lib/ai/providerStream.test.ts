import { describe, expect, test } from "bun:test";
import {
  createAiProviderResponse,
  createAiProviderUiStream,
  type ProviderStreamTelemetry,
} from "./providerStream";

function fakeStream(parts: unknown[]) {
  return new ReadableStream({
    start(controller) {
      for (const part of parts) {
        controller.enqueue(part);
      }
      controller.close();
    },
  });
}

async function collect(stream: ReadableStream<any>) {
  const values: any[] = [];
  for await (const value of stream) {
    values.push(value);
  }
  return values;
}

const successParts = (text: string) => [
  { type: "start" },
  { id: "text-1", type: "text-start" },
  { id: "text-1", text, type: "text-delta" },
  { id: "text-1", type: "text-end" },
  {
    finishReason: "stop",
    rawFinishReason: "stop",
    totalUsage: { inputTokens: 12, outputTokens: 7, totalTokens: 19 },
    type: "finish",
  },
];

describe("budgeted provider stream", () => {
  test("streams primary structured parts and completion telemetry", async () => {
    const telemetry: ProviderStreamTelemetry[] = [];
    const stream = createAiProviderUiStream({
      feature: "concierge",
      models: ["primary:free", "fallback:free"],
      onTelemetry: async (event) => telemetry.push(event),
      startAttempt: () => ({ stream: fakeStream(successParts("Hello")) }),
      totalTimeoutMs: 1000,
    });

    const chunks = await collect(stream);
    expect(chunks.filter((chunk) => chunk.type === "start")).toHaveLength(1);
    expect(chunks).toContainEqual({ delta: "Hello", id: "text-1", type: "text-delta" });
    expect(chunks.at(-1)).toMatchObject({ finishReason: "stop", type: "finish" });
    expect(telemetry).toEqual([
      expect.objectContaining({
        fallback: false,
        feature: "concierge",
        finishReason: "stop",
        inputTokens: 12,
        model: "primary:free",
        outputTokens: 7,
        terminalState: "completed",
      }),
    ]);
  });

  test("falls back only before visible or actionable output", async () => {
    const attempts: string[] = [];
    const telemetry: ProviderStreamTelemetry[] = [];
    const stream = createAiProviderUiStream({
      feature: "journeyPlanner",
      models: ["primary:free", "fallback:free"],
      onTelemetry: async (event) => telemetry.push(event),
      startAttempt: ({ model }) => {
        attempts.push(model);
        return {
          stream:
            model === "primary:free"
              ? fakeStream([
                  { type: "start" },
                  { error: new DOMException("timed out", "TimeoutError"), type: "error" },
                ])
              : fakeStream(successParts("Fallback itinerary")),
        };
      },
      totalTimeoutMs: 1000,
    });

    const chunks = await collect(stream);
    expect(attempts).toEqual(["primary:free", "fallback:free"]);
    expect(chunks.some((chunk) => chunk.type === "error")).toBe(false);
    expect(chunks).toContainEqual({
      delta: "Fallback itinerary",
      id: "text-1",
      type: "text-delta",
    });
    expect(telemetry.at(-1)).toMatchObject({
      fallback: true,
      model: "fallback:free",
      terminalState: "completed",
    });
  });

  test("preserves partial output and marks a post-output timeout interrupted", async () => {
    const telemetry: ProviderStreamTelemetry[] = [];
    const stream = createAiProviderUiStream({
      feature: "concierge",
      models: ["primary:free", "fallback:free"],
      onTelemetry: async (event) => telemetry.push(event),
      startAttempt: () => ({
        stream: fakeStream([
          { type: "start" },
          { id: "text-1", type: "text-start" },
          { id: "text-1", text: "Partial answer", type: "text-delta" },
          { error: new DOMException("timed out", "TimeoutError"), type: "error" },
        ]),
      }),
      totalTimeoutMs: 1000,
    });

    const chunks = await collect(stream);
    expect(chunks).toContainEqual({ delta: "Partial answer", id: "text-1", type: "text-delta" });
    expect(chunks.at(-1)).toMatchObject({ reason: "timeout", type: "abort" });
    expect(telemetry).toEqual([
      expect.objectContaining({ model: "primary:free", terminalState: "interrupted" }),
    ]);
  });

  test("emits one safe error when all providers fail", async () => {
    const telemetry: ProviderStreamTelemetry[] = [];
    const stream = createAiProviderUiStream({
      feature: "concierge",
      models: ["primary:free", "fallback:free"],
      onError: () => "Concierge unavailable.",
      onTelemetry: async (event) => telemetry.push(event),
      startAttempt: () => ({
        stream: fakeStream([{ error: new Error("provider unavailable"), type: "error" }]),
      }),
      totalTimeoutMs: 1000,
    });

    const chunks = await collect(stream);
    expect(chunks.filter((chunk) => chunk.type === "error")).toEqual([
      { errorText: "Concierge unavailable.", type: "error" },
    ]);
    expect(telemetry.at(-1)).toMatchObject({
      fallback: true,
      model: "fallback:free",
      terminalState: "failed",
    });
  });

  test("route disconnect aborts active provider work and records interruption", async () => {
    const controller = new AbortController();
    const telemetry: ProviderStreamTelemetry[] = [];
    const stream = createAiProviderUiStream({
      feature: "concierge",
      models: ["primary:free"],
      onTelemetry: async (event) => telemetry.push(event),
      signal: controller.signal,
      startAttempt: ({ signal }) => ({
        stream: new ReadableStream({
          start(streamController) {
            streamController.enqueue({ type: "start" });
            signal?.addEventListener(
              "abort",
              () => streamController.error(new DOMException("disconnected", "AbortError")),
              { once: true }
            );
            setTimeout(() => controller.abort("client-disconnected"), 0);
          },
        }),
      }),
      totalTimeoutMs: 1000,
    });

    const chunks = await collect(stream);
    expect(chunks.at(-1)).toMatchObject({ reason: "cancelled", type: "abort" });
    expect(telemetry).toEqual([
      expect.objectContaining({ model: "primary:free", terminalState: "interrupted" }),
    ]);
  });

  test("response helper serializes the same structured stream as SSE", async () => {
    const response = createAiProviderResponse({
      feature: "journeyPlanner",
      models: ["primary:free"],
      startAttempt: () => ({ stream: fakeStream(successParts("Safe markdown")) }),
      totalTimeoutMs: 1000,
    });
    const body = await response.text();
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(body).toContain('"type":"text-delta"');
    expect(body).toContain("Safe markdown");
    expect(body).toContain("data: [DONE]");
  });
});
