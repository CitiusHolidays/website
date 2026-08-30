import { afterEach, describe, expect, test } from "bun:test";
import { fromAny, fromPartial } from "@total-typescript/shoehorn";
import type { JsonObject, JsonValue } from "@/lib/jsonValue";
import { handleInboundIntentRequest } from "./route";

type RouteOptions = NonNullable<Parameters<typeof handleInboundIntentRequest>[1]>;
type FetchMutationStub = NonNullable<RouteOptions["fetchMutationImpl"]>;
type MutationCall = [unknown, unknown, { url?: string }?];

const HASH_PATTERN = /^[a-f0-9]{64}$/;
const RECEIPT_REFERENCE = "ENQ-M123-ABCDEF12";
// SAFETY: This test owns and restores the listed process environment keys after every case.
const mutableEnv = fromPartial<Record<string, string | undefined>>(process.env);

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
  const stub = () => Promise.reject(new Error("must not call Convex"));
  // SAFETY: the route test supplies the exact fetchMutation call shape through its options contract.
  return fromPartial<typeof stub & FetchMutationStub>(stub);
}

function fakeMutation(result: JsonValue, onCall?: (call: MutationCall) => void): FetchMutationStub {
  const stub = (...call: MutationCall) => {
    onCall?.(call);
    return Promise.resolve(result);
  };
  // SAFETY: the captured tuple matches the route's fetchMutation dependency contract.
  return fromPartial<typeof stub & FetchMutationStub>(stub);
}

function request(body: JsonObject, headers: Record<string, string> = {}) {
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

function validBodyWithoutLegacyBrief() {
  const {
    destination: _legacyDestination,
    paxCount: _legacyPax,
    travelStartDate: _legacyDate,
    ...body
  } = validBody();
  return body;
}

function configureGateway() {
  mutableEnv.NODE_ENV = "test";
  mutableEnv.INBOUND_INTENT_GATEWAY_SECRET = "gateway-test-secret";
  mutableEnv.INBOUND_INTENT_RATE_LIMIT_SALT = "rate-test-salt";
  mutableEnv.NEXT_PUBLIC_CONVEX_URL = "https://example.convex.cloud";
}

function configureProductionOrigin() {
  Reflect.deleteProperty(mutableEnv, "BETTER_AUTH_URL");
  Reflect.deleteProperty(mutableEnv, "NEXT_PUBLIC_APP_URL");
  Reflect.deleteProperty(mutableEnv, "NEXT_PUBLIC_SITE_URL");
  mutableEnv.SITE_URL = "http://localhost";
}

describe("Protected inbound intent route", () => {
  test("Rejects when the gateway is not configured", async () => {
    mutableEnv.NODE_ENV = "production";
    configureProductionOrigin();
    Reflect.deleteProperty(mutableEnv, "INBOUND_INTENT_GATEWAY_SECRET");
    Reflect.deleteProperty(mutableEnv, "INBOUND_INTENT_RATE_LIMIT_SALT");
    Reflect.deleteProperty(mutableEnv, "NEXT_PUBLIC_CONVEX_URL");
    const response = await handleInboundIntentRequest(request(validBody()), {
      fetchMutationImpl: rejectingMutation(),
    });

    expect(response.status).toBe(503);
  });

  test("Rejects a partially configured Turnstile deployment", async () => {
    configureGateway();
    mutableEnv.NODE_ENV = "production";
    configureProductionOrigin();
    mutableEnv.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "site-key";
    Reflect.deleteProperty(mutableEnv, "TURNSTILE_SECRET_KEY");

    const response = await handleInboundIntentRequest(request(validBody()), {
      fetchMutationImpl: rejectingMutation(),
    });

    expect(response.status).toBe(503);
  });

  test("Validates Turnstile, sends a server-secret gateway request, and creates once", async () => {
    configureGateway();
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "site-key";
    process.env.TURNSTILE_SECRET_KEY = "secret-key";
    const calls: Array<{ args: JsonObject; url?: string }> = [];

    const first = await handleInboundIntentRequest(
      request(validBody(), { "idempotency-key": "form-1" }),
      {
        fetchMutationImpl: fakeMutation(
          {
            intentId: "inboundQueryIntents_1",
            receiptReference: RECEIPT_REFERENCE,
            status: "created",
          },
          (call) => {
            const [, args, options] = call;
            calls.push({
              // SAFETY: This test controls the asserted value at the framework boundary below.
              args: fromAny<JsonObject, unknown>(args),
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
          receiptReference: RECEIPT_REFERENCE,
          status: "duplicate",
        }),
        turnstileVerifier: () => Promise.resolve({ ok: true }),
      }
    );

    expect(first.status).toBe(201);
    expect(await first.json()).toEqual({
      accepted: true,
      duplicate: false,
      receiptReference: RECEIPT_REFERENCE,
      status: "created",
    });
    expect(replay.status).toBe(200);
    expect(await replay.json()).toEqual({
      accepted: true,
      duplicate: true,
      receiptReference: RECEIPT_REFERENCE,
      status: "duplicate",
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://example.convex.cloud");
    expect(calls[0].args.gatewaySecret).toBe("gateway-test-secret");
    expect(calls[0].args.submissionKeyHash).toMatch(HASH_PATTERN);
    expect(calls[0].args.rateLimitKeyHash).toMatch(HASH_PATTERN);
  });

  test("Invalid and throttled requests never call the write gateway", async () => {
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

  test("Accepts the consented Website source without trusting browser identity", async () => {
    configureGateway();
    let forwarded: JsonObject | undefined;
    const response = await handleInboundIntentRequest(
      request({ ...validBody(), source: "Website" }, { "idempotency-key": "website-form-1" }),
      {
        fetchMutationImpl: fakeMutation(
          {
            intentId: "inboundQueryIntents_website",
            receiptReference: RECEIPT_REFERENCE,
            status: "created",
          },
          ([, args]) => {
            // SAFETY: This test controls the asserted value at the framework boundary below.
            forwarded = fromAny<JsonObject, unknown>(args);
          }
        ),
      }
    );

    expect(response.status).toBe(201);
    expect(forwarded).toMatchObject({ consent: true, source: "Website" });
    expect(forwarded).not.toHaveProperty("authUserId");
  });

  test("re-resolves an allowlisted Website context and forwards one typed editable brief", async () => {
    configureGateway();
    let forwarded: JsonObject | undefined;
    const base = validBodyWithoutLegacyBrief();
    const response = await handleInboundIntentRequest(
      request(
        {
          ...base,
          brief: {
            contactWindow: "afternoon",
            dateFlexibility: "flexible",
            destination: " Edited programme ",
            paxCount: 8,
            serviceType: "pilgrimage",
            travelStartDate: "2026-10-12",
          },
          source: "Website",
          websiteSourceContext: {
            intent: "pilgrimage-enquiry",
            trailSlug: "kailash-mansarovar-14day",
          },
        },
        { "idempotency-key": "website-brief-1" }
      ),
      {
        checkRateLimit: () => ({ allowed: true, remaining: 1 }),
        fetchMutationImpl: fakeMutation(
          {
            intentId: "inboundQueryIntents_website",
            receiptReference: RECEIPT_REFERENCE,
            status: "created",
          },
          ([, args]) => {
            forwarded = fromAny<JsonObject, unknown>(args);
          }
        ),
      }
    );

    expect(response.status).toBe(201);
    expect(forwarded).toMatchObject({
      brief: {
        contactWindow: "afternoon",
        dateFlexibility: "flexible",
        destination: "Edited programme",
        paxCount: 8,
        serviceType: "pilgrimage",
        travelStartDate: "2026-10-12",
      },
      websiteSourceContext: {
        intent: "pilgrimage-enquiry",
        label: "Kailash Mansarovar Yatra 2026 enquiry",
        trailSlug: "kailash-mansarovar-14day",
      },
    });
    expect(await response.json()).toEqual({
      accepted: true,
      duplicate: false,
      receiptReference: RECEIPT_REFERENCE,
      status: "created",
    });
  });

  test("rejects malformed briefs and source context before the Convex write", async () => {
    configureGateway();
    let calls = 0;
    const invalidBodies = [
      { brief: { serviceType: "medical_clearance" } },
      { brief: { paxCount: 1.5 } },
      { brief: { travelStartDate: "2026-02-31" } },
      { brief: { attendeePassportNumber: "P123" } },
      {
        websiteSourceContext: {
          intent: "pilgrimage-enquiry",
          label: "Browser supplied label",
          trailSlug: "kailash-mansarovar-14day",
        },
      },
      {
        websiteSourceContext: {
          intent: "pilgrimage-enquiry",
          trailSlug: "kailash-mansarovar-14day/../private",
        },
      },
    ];

    const responses = await Promise.all(
      invalidBodies.map((invalid) =>
        handleInboundIntentRequest(
          request({ ...validBodyWithoutLegacyBrief(), source: "Website", ...invalid }),
          {
            fetchMutationImpl: fakeMutation({ status: "created" }, () => {
              calls += 1;
            }),
          }
        )
      )
    );
    for (const response of responses) {
      expect(response.status).toBe(400);
    }
    expect(calls).toBe(0);
  });

  test("fails closed when the durable gateway receipt is missing and never exposes the record id", async () => {
    configureGateway();
    const response = await handleInboundIntentRequest(request(validBody()), {
      fetchMutationImpl: fakeMutation({
        intentId: "inboundQueryIntents_private",
        status: "created",
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).not.toHaveProperty("intentId");
    expect(JSON.stringify(body)).not.toContain("inboundQueryIntents_private");
  });

  test("rejects unsupported request fields before calling Convex", async () => {
    configureGateway();
    let calls = 0;
    const response = await handleInboundIntentRequest(
      request({
        ...validBody(),
        source: "Website",
        unsupportedField: true,
      }),
      {
        fetchMutationImpl: fakeMutation({ status: "created" }, () => {
          calls += 1;
        }),
      }
    );

    expect(response.status).toBe(400);
    expect(calls).toBe(0);
    expect(await response.json()).toMatchObject({
      error: "Request contains unsupported fields.",
    });
  });

  test("reports a paused CRM intake as unavailable instead of a false form success", async () => {
    configureGateway();
    const response = await handleInboundIntentRequest(request(validBody()), {
      checkRateLimit: () => ({ allowed: true, remaining: 1 }),
      fetchMutationImpl: fakeMutation({
        effects: {
          crmIntake: "suppressed",
          infoMailboxEmail: "suppressed",
          salesBell: "suppressed",
          salesEmail: "suppressed",
        },
        status: "disabled",
      }),
    });

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      accepted: false,
      effects: {
        crmIntake: "suppressed",
        infoMailboxEmail: "suppressed",
        salesBell: "suppressed",
        salesEmail: "suppressed",
      },
      error: "Enquiry intake is temporarily paused. Please try again shortly.",
      status: "disabled",
    });
  });

  test("Canonicalizes Sacred Bharat context and redacts progress and generated text", async () => {
    configureGateway();
    let forwarded: JsonObject | undefined;
    const response = await handleInboundIntentRequest(
      request(
        {
          ...validBody(),
          generatedPlan: "private model output",
          notes: "must not cross the Sacred Bharat boundary",
          progress: { score: 900, visitedTempleIds: ["kedarnath"] },
          sacredBharatContext: { entryPoint: "journey_planner", templeId: "varanasi" },
          source: "Sacred Bharat",
          wishlist: ["shiva-trail"],
        },
        { "idempotency-key": "sacred-plan-1" }
      ),
      {
        checkRateLimit: () => ({ allowed: true, remaining: 1 }),
        fetchMutationImpl: fakeMutation(
          {
            intentId: "inboundQueryIntents_sacred",
            receiptReference: RECEIPT_REFERENCE,
            status: "created",
          },
          ([, args]) => {
            // SAFETY: This test controls the asserted value at the framework boundary below.
            forwarded = fromAny<JsonObject, unknown>(args);
          }
        ),
      }
    );

    expect(response.status).toBe(201);
    expect(forwarded).toMatchObject({
      sacredBharatContext: {
        entryPoint: "journey_planner",
        templeId: "kashi-vishwanath",
      },
      source: "Sacred Bharat",
    });
    expect(forwarded).not.toHaveProperty("generatedPlan");
    expect(forwarded).not.toHaveProperty("notes");
    expect(forwarded).not.toHaveProperty("progress");
    expect(forwarded).not.toHaveProperty("wishlist");
  });

  test("Rejects Sacred Bharat requests without a known explicit planning context", async () => {
    configureGateway();
    let calls = 0;
    const response = await handleInboundIntentRequest(
      request({
        ...validBody(),
        sacredBharatContext: { entryPoint: "trail", trailSlug: "unknown" },
        source: "Sacred Bharat",
      }),
      {
        fetchMutationImpl: fakeMutation({ intentId: null, status: "created" }, () => {
          calls += 1;
        }),
      }
    );

    expect(response.status).toBe(400);
    expect(calls).toBe(0);
  });
});
