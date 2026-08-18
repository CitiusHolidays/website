import { describe, expect, test } from "bun:test";
import { isJsonObject, readJsonBodyWithinLimit } from "./readJsonBody.js";

test("Recognizes JSON object bodies", () => {
  expect(isJsonObject({ ok: true })).toBe(true);
  expect(isJsonObject(null)).toBe(false);
  expect(isJsonObject([])).toBe(false);
});

describe("ReadJsonBodyWithinLimit", () => {
  test("Reads a body within the byte limit", async () => {
    const result = await readJsonBodyWithinLimit(
      new Request("https://example.test", { body: JSON.stringify({ ok: true }), method: "POST" }),
      100
    );
    expect(result).toEqual({ ok: true, value: { ok: true } });
  });

  test("Rejects declared and streamed bodies over the limit", async () => {
    const declared = await readJsonBodyWithinLimit(
      new Request("https://example.test", {
        body: JSON.stringify({ value: "12345" }),
        headers: { "content-length": "1000" },
        method: "POST",
      }),
      10
    );
    const streamed = await readJsonBodyWithinLimit(
      new Request("https://example.test", {
        body: JSON.stringify({ value: "12345" }),
        method: "POST",
      }),
      10
    );
    expect(declared).toEqual({ ok: false, reason: "too_large" });
    expect(streamed).toEqual({ ok: false, reason: "too_large" });
  });

  test("Cancels a chunked body as soon as it crosses the limit", async () => {
    let cancelled = false;
    const request = new Request("https://example.test", {
      body: new ReadableStream({
        cancel() {
          cancelled = true;
        },
        start(controller) {
          controller.enqueue(new TextEncoder().encode('{"value":"12345"}'));
          controller.enqueue(new TextEncoder().encode("more data"));
        },
      }),
      method: "POST",
    });

    const result = await readJsonBodyWithinLimit(request, 10);
    expect(result).toEqual({ ok: false, reason: "too_large" });
    expect(cancelled).toBe(true);
  });

  test("Rejects malformed JSON", async () => {
    const result = await readJsonBodyWithinLimit(
      new Request("https://example.test", { body: "{", method: "POST" }),
      100
    );
    expect(result).toEqual({ ok: false, reason: "invalid_json" });
  });
});
