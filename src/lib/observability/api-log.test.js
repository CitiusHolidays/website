import { describe, expect, test } from "bun:test";
import { buildApiLog, requestIdFor, withApiRequestLogging } from "./api-log.js";

describe("API observability boundary", () => {
  test("accepts safe inbound request IDs and replaces unsafe values", () => {
    expect(
      requestIdFor(
        new Request("https://example.test", { headers: { "x-request-id": "abc-1" } }),
        () => "new"
      )
    ).toBe("abc-1");
    expect(
      requestIdFor(
        new Request("https://example.test", { headers: { "x-request-id": "bad value" } }),
        () => "new"
      )
    ).toBe("req_new");
  });

  test("redacts secrets and contact PII before serialization", () => {
    const payload = buildApiLog({
      apiKey: "secret-value",
      email: "staff@example.com",
      nested: { authorization: "Bearer secret", ok: true },
      requestId: "req_1",
    });
    expect(payload).toEqual({
      apiKey: "[redacted]",
      email: "[redacted]",
      nested: { authorization: "[redacted]", ok: true },
      requestId: "req_1",
      service: "citius-web",
      timestamp: expect.any(String),
    });
  });

  test("logs and returns the same request ID on successful responses", async () => {
    const logs = [];
    const logger = {
      error: () => undefined,
      info: (line) => logs.push(JSON.parse(line)),
      warn: () => undefined,
    };
    const response = await withApiRequestLogging(
      new Request("https://example.test", {
        headers: { "x-request-id": "req_known" },
        method: "POST",
      }),
      "/api/example",
      ({ requestId }) => {
        expect(requestId).toBe("req_known");
        return Promise.resolve(new Response("ok", { status: 201 }));
      },
      { createId: () => "unused", logger }
    );
    expect(response.headers.get("x-request-id")).toBe("req_known");
    expect(response.status).toBe(201);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ requestId: "req_known", route: "/api/example", status: 201 });
  });
});
