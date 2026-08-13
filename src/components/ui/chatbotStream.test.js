import { describe, expect, test } from "bun:test";
import { chatResponseErrorMessage } from "./chatbotStream";

describe("chat response errors", () => {
  test("does not render arbitrary JSON or plain response bodies", async () => {
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

  test("uses a stable fallback for an empty provider response", async () => {
    const response = new Response(null, { status: 503 });

    await expect(chatResponseErrorMessage(response)).resolves.toBe(
      "Citius Concierge is temporarily unavailable. Please try again."
    );
  });

  test("keeps rate-limit and oversized-request recovery specific", async () => {
    await expect(chatResponseErrorMessage(new Response(null, { status: 429 }))).resolves.toContain(
      "try again shortly"
    );
    await expect(chatResponseErrorMessage(new Response(null, { status: 413 }))).resolves.toContain(
      "Shorten it"
    );
  });
});
