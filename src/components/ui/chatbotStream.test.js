import { describe, expect, test } from "bun:test";
import { chatResponseErrorMessage } from "./chatbotStream";

describe("chat response errors", () => {
  test("extracts the safe API error instead of rendering raw JSON", async () => {
    const response = new Response(JSON.stringify({ error: "Chat service is not configured." }), {
      status: 503,
    });

    await expect(chatResponseErrorMessage(response)).resolves.toBe(
      "Chat service is not configured."
    );
  });

  test("uses a stable fallback for an empty provider response", async () => {
    const response = new Response(null, { status: 503 });

    await expect(chatResponseErrorMessage(response)).resolves.toBe(
      "Citius Concierge is temporarily unavailable. Please try again."
    );
  });
});
