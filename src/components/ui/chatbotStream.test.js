import { describe, expect, test } from "bun:test";
import { chatResponseErrorMessage } from "./chatbotStream";

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
});
