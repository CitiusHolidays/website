import { afterEach, describe, expect, mock, test } from "bun:test";
import { chatResponseErrorMessage, streamChatResponse } from "./chatbotStream";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  mock.restore();
});

describe("Chat response errors", () => {
  test("Does not render arbitrary JSON or plain response bodies", async () => {
    const secret = "provider failed with secret-value";
    const response = new Response(JSON.stringify({ error: secret }), {
      status: 503,
    });

    await expect(chatResponseErrorMessage(response)).resolves.toBe(
      "Citius Concierge is temporarily unavailable. Please try again."
    );
    expect(await chatResponseErrorMessage(new Response(secret, { status: 502 }))).not.toContain(
      secret
    );
  });

  test("Uses a stable fallback for an empty provider response", async () => {
    const response = new Response(null, { status: 503 });

    await expect(chatResponseErrorMessage(response)).resolves.toBe(
      "Citius Concierge is temporarily unavailable. Please try again."
    );
  });

  test("Keeps rate-limit and oversized-request recovery specific", async () => {
    await expect(chatResponseErrorMessage(new Response(null, { status: 429 }))).resolves.toContain(
      "try again shortly"
    );
    await expect(chatResponseErrorMessage(new Response(null, { status: 413 }))).resolves.toContain(
      "Shorten it"
    );
  });

  test("Adds only a bounded request reference to recoverable failures", async () => {
    const response = new Response(null, {
      headers: { "x-request-id": "req_6d40d97e-b674-4b7e-a581-81f52b1016a6" },
      status: 503,
    });

    await expect(chatResponseErrorMessage(response)).resolves.toBe(
      "Citius Concierge is temporarily unavailable. Please try again. Reference: req_6d40d97e-b674-4b7e-a581-81f52b1016a6"
    );

    const unsafeReference = new Response(null, {
      headers: { "x-request-id": "<script>secret</script>" },
      status: 503,
    });
    await expect(chatResponseErrorMessage(unsafeReference)).resolves.not.toContain("script");
  });

  test("forwards the one-time bot challenge with the chat request", async () => {
    let requestBody;
    globalThis.fetch = mock((_url, init) => {
      requestBody = JSON.parse(init.body);
      return Promise.resolve(new Response(null, { status: 403 }));
    });

    await streamChatResponse({
      assistantId: "assistant-1",
      messages: [],
      onMessage: () => undefined,
      onStreamError: () => undefined,
      signal: new AbortController().signal,
      turnstileToken: "challenge-token",
      userMessage: { id: "user-1" },
    });

    expect(requestBody.turnstileToken).toBe("challenge-token");
  });

  test("keeps the request reference when a successful stream fails mid-response", async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode(
            'data: {"type":"error","errorText":"The provider stopped early."}\n\n'
          )
        );
        controller.close();
      },
    });
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "x-request-id": "req_8240042f-0bf5-45d8-a54c-6f0435fd41fb",
          },
          status: 200,
        })
      )
    );

    const result = await streamChatResponse({
      assistantId: "assistant-stream",
      messages: [],
      onMessage: () => undefined,
      onStreamError: () => undefined,
      signal: new AbortController().signal,
      userMessage: { id: "user-stream" },
    });

    expect(result.message.requestId).toBe("assistant-stream");
    expect(result.message.requestReference).toBe("req_8240042f-0bf5-45d8-a54c-6f0435fd41fb");
    expect(result.message.parts.find((part) => part.type === "error")?.text).toBe(
      "The provider stopped early. Reference: req_8240042f-0bf5-45d8-a54c-6f0435fd41fb"
    );
  });
});
