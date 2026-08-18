import { describe, expect, test } from "bun:test";
import { buildApiCompletionLog, requestIdFor, withApiRequestLogging } from "./api-log.js";

describe("API observability boundary", () => {
  test("Accepts safe inbound request IDs and replaces unsafe values", () => {
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

  test("Logs and returns the same request ID on successful responses", async () => {
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
      "/api/revalidate",
      ({ requestId }) => {
        expect(requestId).toBe("req_known");
        return Promise.resolve(new Response("ok", { status: 201 }));
      },
      { createId: () => "unused", logger }
    );
    expect(response.headers.get("x-request-id")).toBe("req_known");
    expect(response.status).toBe(201);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      completion: "handler_returned",
      event: "api.request.completed",
      family: "content",
      method: "POST",
      outcome: "response",
      requestId: "req_known",
      responseMode: "json",
      route: "/api/revalidate",
      status: 201,
    });
  });

  test("Preserves delegated responses when the logger is unavailable", async () => {
    const response = await withApiRequestLogging(
      new Request("https://example.test/api/auth/session", { method: "GET" }),
      "/api/auth/[...all]",
      () => Promise.resolve(Response.redirect("https://example.test/auth/connect", 302)),
      {
        createId: () => "delegated",
        logger: {
          error: () => {
            throw new Error("logger unavailable");
          },
          info: () => {
            throw new Error("logger unavailable");
          },
          warn: () => undefined,
        },
      }
    );
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://example.test/auth/connect");
    expect(response.headers.get("x-request-id")).toBe("req_delegated");
  });

  test("Completion logs expose only the closed content-free schema", () => {
    const payload = buildApiCompletionLog(
      {
        completion: "handler_returned",
        durationMs: 12,
        email: "must-not-appear@example.test",
        family: "contact",
        method: "POST",
        outcome: "response",
        providerBody: { secret: true },
        requestId: "req_safe",
        responseMode: "json",
        route: "/api/contact",
        status: 200,
      },
      () => new Date("2026-08-13T00:00:00.000Z")
    );
    expect(payload).toEqual({
      completion: "handler_returned",
      durationMs: 12,
      event: "api.request.completed",
      family: "contact",
      method: "POST",
      outcome: "response",
      requestId: "req_safe",
      responseMode: "json",
      route: "/api/contact",
      service: "citius-web",
      status: 200,
      timestamp: "2026-08-13T00:00:00.000Z",
    });
  });

  test("Logs a streaming request only after the body closes", async () => {
    const logs = [];
    const logger = {
      error: (line) => logs.push(JSON.parse(line)),
      info: (line) => logs.push(JSON.parse(line)),
      warn: () => undefined,
    };
    const response = await withApiRequestLogging(
      new Request("https://example.test/api/chat", { method: "POST" }),
      "/api/chat",
      () => Promise.resolve(new Response("streamed", { status: 200 })),
      { createId: () => "stream", logger }
    );
    expect(logs).toHaveLength(0);
    expect(await response.text()).toBe("streamed");
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      completion: "stream_closed",
      outcome: "closed",
      responseMode: "stream",
      route: "/api/chat",
    });
  });

  test("Fails closed for an unregistered route or method", async () => {
    await expect(
      withApiRequestLogging(
        new Request("https://example.test/api/unknown", { method: "GET" }),
        "/api/unknown",
        () => Promise.resolve(Response.json({ ok: true }))
      )
    ).rejects.toThrow("Unregistered API observability route");
    await expect(
      withApiRequestLogging(
        new Request("https://example.test/api/contact", { method: "GET" }),
        "/api/contact",
        () => Promise.resolve(Response.json({ ok: true }))
      )
    ).rejects.toThrow("Unregistered API observability method");
  });
});
