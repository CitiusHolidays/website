import { afterEach, describe, expect, test } from "bun:test";
import { handleInboundIntentRequest } from "./route";

type RouteOptions = NonNullable<Parameters<typeof handleInboundIntentRequest>[1]>;
type FetchMutationStub = NonNullable<RouteOptions["fetchMutationImpl"]>;
type MutationCall = [unknown, unknown, { url?: string }?];

const HASH_PATTERN = /^[a-f0-9]{64}$/;
const mutableEnv = process.env as Record<string, string | undefined>;

const ENV_KEYS = [
  "BETTER_AUTH_URL",
  "INBOUND_INTENT_GATEWAY_SECRET",
  "INBOUND_INTENT_RATE_LIMIT_SALT",
  "NEXT_PUBLIC_CONVEX_URL",
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SITE_URL",
  "SITE_URL",
  "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
  "TURNSTILE_SECRET_KEY",
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

function rejectingMutation() {
  return (() => Promise.reject(new Error("must not call Convex"))) as unknown as FetchMutationStub;
}

function fakeMutation(result: unknown, onCall?: (call: MutationCall) => void): FetchMutationStub {
  return ((...call: MutationCall) => {
    onCall?.(call);
    return Promise.resolve(result);
  }) as unknown as FetchMutationStub;
}

function request(body: Record<string, unknown>, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/inbound-intents", {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json", Origin: "http://localhost", ...headers },
    method: "POST",
  });
}

function validBody() {
  return {
    clientName: "A Traveller",
    consent: true,
    contactEmail: "traveller@example.com",
    destination: "Kerala",
    formLoadedAt: Date.now() - 4000,
    notes: "A private journey enquiry.",
    paxCount: 2,
    source: "Citius Concierge",
    travelStartDate: "2026-10-12",
  };
}

function configureGateway() {
  mutableEnv.NODE_ENV = "test";
  mutableEnv.INBOUND_INTENT_GATEWAY_SECRET = "gateway-test-secret";
  mutableEnv.INBOUND_INTENT_RATE_LIMIT_SALT = "rate-test-salt";
  mutableEnv.NEXT_PUBLIC_CONVEX_URL = "https://example.convex.cloud";
}

function configureProductionOrigin() {
  mutableEnv.BETTER_AUTH_URL = undefined;
  mutableEnv.NEXT_PUBLIC_APP_URL = undefined;
  mutableEnv.NEXT_PUBLIC_SITE_URL = undefined;
  mutableEnv.SITE_URL = "http://localhost";
}

describe("protected inbound intent route", () => {
  test("rejects when the gateway is not configured", async () => {
    mutableEnv.NODE_ENV = "production";
    configureProductionOrigin();
    const response = await handleInboundIntentRequest(request(validBody()), {
      fetchMutationImpl: rejectingMutation(),
    });

    expect(response.status).toBe(503);
  });

  test("rejects a partially configured Turnstile deployment", async () => {
    configureGateway();
    mutableEnv.NODE_ENV = "production";
    configureProductionOrigin();
    mutableEnv.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "site-key";
    mutableEnv.TURNSTILE_SECRET_KEY = undefined;

    const response = await handleInboundIntentRequest(request(validBody()), {
      fetchMutationImpl: rejectingMutation(),
    });

    expect(response.status).toBe(503);
  });

  test("validates Turnstile, sends a server-secret gateway request, and creates once", async () => {
    configureGateway();
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "site-key";
    process.env.TURNSTILE_SECRET_KEY = "secret-key";
    const calls: Array<{ args: Record<string, unknown>; url?: string }> = [];

    const first = await handleInboundIntentRequest(
      request(validBody(), { "idempotency-key": "form-1" }),
      {
        fetchMutationImpl: fakeMutation(
          { intentId: "inboundQueryIntents_1", status: "created" },
          (call) => {
            const [, args, options] = call;
            calls.push({
              args: args as Record<string, unknown>,
              url: options?.url,
            });
          }
        ),
        turnstileVerifier: (token, remoteIp) => {
          expect(token).toBeUndefined();
          expect(remoteIp).toBe("unknown");
          return Promise.resolve({ ok: true });
        },
      }
    );
    const replay = await handleInboundIntentRequest(
      request(validBody(), { "idempotency-key": "form-1" }),
      {
        fetchMutationImpl: fakeMutation({
          intentId: "inboundQueryIntents_1",
          status: "duplicate",
        }),
        turnstileVerifier: () => Promise.resolve({ ok: true }),
      }
    );

    expect(first.status).toBe(201);
    expect(await first.json()).toEqual({ accepted: true, duplicate: false });
    expect(replay.status).toBe(200);
    expect(await replay.json()).toEqual({ accepted: true, duplicate: true });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://example.convex.cloud");
    expect(calls[0].args.gatewaySecret).toBe("gateway-test-secret");
    expect(calls[0].args.submissionKeyHash).toMatch(HASH_PATTERN);
    expect(calls[0].args.rateLimitKeyHash).toMatch(HASH_PATTERN);
  });

  test("invalid and throttled requests never call the write gateway", async () => {
    configureGateway();
    let calls = 0;
    const invalid = await handleInboundIntentRequest(request({ ...validBody(), consent: false }), {
      fetchMutationImpl: fakeMutation({ intentId: null, status: "created" }, () => {
        calls += 1;
      }),
    });
    const throttled = await handleInboundIntentRequest(request(validBody()), {
      checkRateLimit: () => ({ allowed: false, retryAfterSec: 60 }),
      fetchMutationImpl: fakeMutation({ intentId: null, status: "created" }, () => {
        calls += 1;
      }),
    });

    expect(invalid.status).toBe(400);
    expect(throttled.status).toBe(429);
    expect(calls).toBe(0);
  });

  test("accepts the consented Website source without trusting browser identity", async () => {
    configureGateway();
    let forwarded: Record<string, unknown> | undefined;
    const response = await handleInboundIntentRequest(
      request({ ...validBody(), source: "Website" }, { "idempotency-key": "website-form-1" }),
      {
        fetchMutationImpl: fakeMutation(
          { intentId: "inboundQueryIntents_website", status: "created" },
          ([, args]) => {
            forwarded = args as Record<string, unknown>;
          }
        ),
      }
    );

    expect(response.status).toBe(201);
    expect(forwarded).toMatchObject({ consent: true, source: "Website" });
    expect(forwarded).not.toHaveProperty("authUserId");
  });
});
