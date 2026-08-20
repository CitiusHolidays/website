import { afterEach, describe, expect, test } from "bun:test";
import { fromPartial } from "@total-typescript/shoehorn";
import { handleChatRequest } from "./route";

// SAFETY: This test owns and restores the listed process environment keys after every case.
const mutableEnv = fromPartial<Record<string, string | undefined>>(process.env);
const ENV_KEYS = [
  "BETTER_AUTH_URL",
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SITE_URL",
  "SITE_URL",
  "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
  "TURNSTILE_SECRET_KEY",
  "OPENROUTER_API_KEY",
  "OPERATIONAL_CONTROL_GATEWAY_SECRET",
  "NODE_ENV",
] as const;
const originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = originalEnv[key];
    if (value === undefined) {
      delete mutableEnv[key];
    } else {
      mutableEnv[key] = value;
    }
  }
});

function request(turnstileToken?: string) {
  return new Request("http://localhost/api/chat", {
    body: JSON.stringify({
      messages: [{ id: "message-1", parts: [{ text: "Plan Kerala", type: "text" }], role: "user" }],
      turnstileToken,
    }),
    headers: { "Content-Type": "application/json", Origin: "http://localhost" },
    method: "POST",
  });
}

function configureProductionOrigin() {
  Reflect.deleteProperty(mutableEnv, "BETTER_AUTH_URL");
  Reflect.deleteProperty(mutableEnv, "NEXT_PUBLIC_APP_URL");
  Reflect.deleteProperty(mutableEnv, "NEXT_PUBLIC_SITE_URL");
  mutableEnv.SITE_URL = "http://localhost";
  mutableEnv.NODE_ENV = "production";
  mutableEnv.OPENROUTER_API_KEY = "openrouter-test-key";
}

describe("Protected Concierge route", () => {
  test("fails closed when Production Turnstile configuration is absent", async () => {
    configureProductionOrigin();
    Reflect.deleteProperty(mutableEnv, "NEXT_PUBLIC_TURNSTILE_SITE_KEY");
    Reflect.deleteProperty(mutableEnv, "TURNSTILE_SECRET_KEY");

    const response = await handleChatRequest(request(), {
      consumeRateLimit: () => Promise.reject(new Error("must not reach rate limit")),
      resolveControl: () =>
        Promise.resolve({
          blockedBy: [],
          enabled: true,
          key: "ai.concierge",
          reason: "standard",
        }),
    });

    expect(response.status).toBe(503);
  });

  test("rejects a failed bot challenge before consuming shared AI capacity", async () => {
    configureProductionOrigin();
    mutableEnv.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "site-key";
    mutableEnv.TURNSTILE_SECRET_KEY = "secret-key";
    let rateLimitCalls = 0;

    const response = await handleChatRequest(request("bad-token"), {
      consumeRateLimit: () => {
        rateLimitCalls += 1;
        return Promise.resolve({ allowed: true, remaining: 1, retryAfterSec: 0 });
      },
      resolveControl: () =>
        Promise.resolve({
          blockedBy: [],
          enabled: true,
          key: "ai.concierge",
          reason: "standard",
        }),
      turnstileVerifier: (token, remoteIp) => {
        expect(token).toBe("bad-token");
        expect(remoteIp).toBe("unknown");
        return Promise.resolve({ error: "invalid-input-response", ok: false } as const);
      },
    });

    expect(response.status).toBe(403);
    expect(rateLimitCalls).toBe(0);
  });

  test("accepts a valid challenge and preserves the existing shared rate limit", async () => {
    mutableEnv.NODE_ENV = "test";
    mutableEnv.OPENROUTER_API_KEY = "openrouter-test-key";
    mutableEnv.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "site-key";
    mutableEnv.TURNSTILE_SECRET_KEY = "secret-key";

    const response = await handleChatRequest(request("good-token"), {
      consumeRateLimit: () => Promise.resolve({ allowed: false, remaining: 0, retryAfterSec: 42 }),
      resolveControl: () =>
        Promise.resolve({
          blockedBy: [],
          enabled: true,
          key: "ai.concierge",
          reason: "standard",
        }),
      turnstileVerifier: () => Promise.resolve({ ok: true } as const),
    });

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("42");
  });

  test("returns a clear paused state before spending bot or AI capacity", async () => {
    mutableEnv.NODE_ENV = "test";
    mutableEnv.OPENROUTER_API_KEY = "openrouter-test-key";
    let rateLimitCalls = 0;

    const response = await handleChatRequest(request(), {
      consumeRateLimit: () => {
        rateLimitCalls += 1;
        return Promise.resolve({ allowed: true, remaining: 1, retryAfterSec: 0 });
      },
      resolveControl: () =>
        Promise.resolve({
          blockedBy: [],
          enabled: false,
          key: "ai.concierge",
          reason: "operator_disabled",
        }),
    });

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Citius Concierge is currently paused." });
    expect(rateLimitCalls).toBe(0);
  });

  test("rechecks Concierge immediately before the provider boundary", async () => {
    mutableEnv.NODE_ENV = "test";
    mutableEnv.OPENROUTER_API_KEY = "openrouter-test-key";
    let controlChecks = 0;

    const response = await handleChatRequest(request(), {
      consumeRateLimit: () => Promise.resolve({ allowed: true, remaining: 1, retryAfterSec: 0 }),
      resolveControl: () => {
        controlChecks += 1;
        return Promise.resolve({
          blockedBy: [],
          enabled: controlChecks === 1,
          key: "ai.concierge",
          reason: controlChecks === 1 ? "configured_default" : "explicit_disabled",
        });
      },
    });

    expect(response.status).toBe(503);
    expect(controlChecks).toBe(2);
    expect(await response.json()).toEqual({ error: "Citius Concierge is currently paused." });
  });
});
