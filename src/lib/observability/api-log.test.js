import { describe, expect, test } from "bun:test";
import { buildApiCompletionLog, requestIdFor, withApiRequestLogging } from "./api-log.js";

describe("API observability boundary", () => {
  test("Always mints request IDs on the server and ignores caller values", () => {
    expect(
      requestIdFor(
        new Request("https://example.test", { headers: { "x-request-id": "abc-1" } }),
        () => "new"
      )
    ).toBe("req_new");
    expect(
      requestIdFor(
        new Request("https://example.test", {
          headers: { "x-request-id": "caller-secret-sentinel" },
        }),
        () => "other"
      )
    ).toBe("req_other");
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
        expect(requestId).toBe("req_minted");
        return Promise.resolve(new Response("ok", { status: 201 }));
      },
      { createId: () => "minted", logger }
    );
    expect(response.headers.get("x-request-id")).toBe("req_minted");
    expect(response.status).toBe(201);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      completion: "handler_returned",
      errorCategory: null,
      event: "api.request.completed",
      family: "content",
      method: "POST",
      outcome: "response",
      requestId: "req_minted",
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
        errorCategory: null,
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
      errorCategory: null,
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

  test("Classifies handled JSON 5xx responses as one closed error event", async () => {
    const errors = [];
    const response = await withApiRequestLogging(
      new Request("https://example.test/api/contact", { method: "POST" }),
      "/api/contact",
      () =>
        Promise.resolve(
          Response.json(
            { error: "provider-body-sentinel", recordId: "record-id-sentinel" },
            { status: 503 }
          )
        ),
      {
        createId: () => "handled-5xx",
        logger: {
          error: (line) => errors.push(JSON.parse(line)),
          info: () => undefined,
          warn: () => undefined,
        },
      }
    );

    expect(response.status).toBe(503);
    expect(errors).toEqual([
      expect.objectContaining({
        completion: "handler_returned",
        errorCategory: "contact_submission_failure",
        outcome: "response",
        requestId: "req_handled-5xx",
        status: 503,
      }),
    ]);
    expect(JSON.stringify(errors)).not.toContain("provider-body-sentinel");
    expect(JSON.stringify(errors)).not.toContain("record-id-sentinel");
  });

  test("Keeps handled 4xx responses informational without an error category", async () => {
    const errors = [];
    const infos = [];
    const response = await withApiRequestLogging(
      new Request("https://example.test/api/contact", { method: "POST" }),
      "/api/contact",
      () => Promise.resolve(Response.json({ error: "validation failed" }, { status: 400 })),
      {
        createId: () => "handled-4xx",
        logger: {
          error: (line) => errors.push(JSON.parse(line)),
          info: (line) => infos.push(JSON.parse(line)),
          warn: () => undefined,
        },
      }
    );

    expect(response.status).toBe(400);
    expect(errors).toHaveLength(0);
    expect(infos).toEqual([
      expect.objectContaining({
        errorCategory: null,
        outcome: "response",
        requestId: "req_handled-4xx",
        status: 400,
      }),
    ]);
  });

  test("Classifies handled delegated 5xx responses as errors", async () => {
    const errors = [];
    const response = await withApiRequestLogging(
      new Request("https://example.test/api/auth/session", { method: "GET" }),
      "/api/auth/[...all]",
      () => Promise.resolve(Response.json({ error: "auth unavailable" }, { status: 503 })),
      {
        createId: () => "delegated-5xx",
        logger: {
          error: (line) => errors.push(JSON.parse(line)),
          info: () => undefined,
          warn: () => undefined,
        },
      }
    );

    expect(response.status).toBe(503);
    expect(errors).toEqual([
      expect.objectContaining({
        completion: "handler_returned",
        errorCategory: "authentication_failure",
        requestId: "req_delegated-5xx",
        responseMode: "delegated",
        status: 503,
      }),
    ]);
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

  test("Classifies a handled streaming 5xx only when the stream closes", async () => {
    const errors = [];
    const response = await withApiRequestLogging(
      new Request("https://example.test/api/chat", { method: "POST" }),
      "/api/chat",
      () => Promise.resolve(new Response("safe fallback", { status: 503 })),
      {
        createId: () => "stream-5xx",
        logger: {
          error: (line) => errors.push(JSON.parse(line)),
          info: () => undefined,
          warn: () => undefined,
        },
      }
    );

    expect(errors).toHaveLength(0);
    expect(await response.text()).toBe("safe fallback");
    expect(errors).toEqual([
      expect.objectContaining({
        completion: "stream_closed",
        errorCategory: "ai_service_failure",
        outcome: "closed",
        status: 503,
      }),
    ]);
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
