import { afterEach, describe, expect, test } from "bun:test";
import { fromPartial } from "@total-typescript/shoehorn";
import { ConvexError } from "convex/values";
import type { JsonObject, JsonValue } from "@/lib/jsonValue";
import { handleSacredBharatEditionEvent } from "./route";

type RouteOptions = NonNullable<Parameters<typeof handleSacredBharatEditionEvent>[1]>;
type MutationStub = NonNullable<RouteOptions["fetchMutationImpl"]>;
// SAFETY: These route tests restore every mutated key after each test.
const mutableEnv = fromPartial<Record<string, string | undefined>>(process.env);
const ENV_KEYS = [
  "BETTER_AUTH_URL",
  "NEXT_PUBLIC_CONVEX_URL",
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SITE_URL",
  "NODE_ENV",
  "SACRED_BHARAT_EVENT_GATEWAY_SECRET",
  "SITE_URL",
] as const;
const originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

function setEnv(key: (typeof ENV_KEYS)[number], value: string | undefined) {
  if (value === undefined) {
    delete mutableEnv[key];
    return;
  }
  mutableEnv[key] = value;
}

afterEach(() => {
  for (const key of ENV_KEYS) {
    setEnv(key, originalEnv[key]);
  }
});

function request(body: JsonObject, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/sacred-bharat/events", {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json", Origin: "http://localhost", ...headers },
    method: "POST",
  });
}

function mutationStub(result: JsonValue, onArgs?: (args: JsonObject) => void): MutationStub {
  // SAFETY: The test stub accepts the same reference position as fetchMutation and the route
  // supplies the strictly bounded JSON object verified by these tests.
  const stub = fromPartial<MutationStub>(
    (_reference: Parameters<MutationStub>[0], args: JsonObject) => {
      onArgs?.(args);
      return Promise.resolve(result);
    }
  );
  return stub;
}

function validEvent() {
  return {
    edition: "001",
    event: "edition_started",
    eventId: "b".repeat(32),
    playerToken: "a".repeat(24),
    referrerToken: "c".repeat(32),
    shareToken: "d".repeat(32),
  };
}

function configureGateway() {
  mutableEnv.NODE_ENV = "test";
  mutableEnv.NEXT_PUBLIC_CONVEX_URL = "https://example.convex.cloud";
  mutableEnv.SACRED_BHARAT_EVENT_GATEWAY_SECRET = "event-gateway-secret";
}

const rateLimitKey = () => Promise.resolve("e".repeat(64));

describe("Sacred Bharat / 001 event gateway", () => {
  test("adds the server capability and accepts a strictly bounded event", async () => {
    configureGateway();
    let forwarded: JsonObject | undefined;
    const response = await handleSacredBharatEditionEvent(request(validEvent()), {
      fetchMutationImpl: mutationStub(
        { attributed: true, eventRecordId: "event_1", replayed: false },
        (args) => {
          forwarded = args;
        }
      ),
      rateLimitKey,
    });

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ accepted: true });
    expect(forwarded).toMatchObject({
      ...validEvent(),
      gatewaySecret: "event-gateway-secret",
      rateLimitKeyHash: "e".repeat(64),
    });
  });

  test("rejects unknown fields so analytics cannot become a PII sink", async () => {
    configureGateway();
    let calls = 0;
    const response = await handleSacredBharatEditionEvent(
      request({ ...validEvent(), email: "traveller@example.com" }),
      {
        fetchMutationImpl: mutationStub({}, () => {
          calls += 1;
        }),
        rateLimitKey,
      }
    );

    expect(response.status).toBe(400);
    expect(calls).toBe(0);
  });

  test("fails closed for an unregistered edition or edition-mismatched vocabulary", async () => {
    configureGateway();
    let calls = 0;
    const options = {
      fetchMutationImpl: mutationStub({}, () => {
        calls += 1;
      }),
      rateLimitKey,
    };
    const unknownEdition = await handleSacredBharatEditionEvent(
      request({ ...validEvent(), edition: "002" }),
      options
    );
    const unknownQuestion = await handleSacredBharatEditionEvent(
      request({
        correct: true,
        edition: "001",
        event: "question_answered",
        eventId: "c".repeat(32),
        playerToken: "a".repeat(24),
        questionId: "future-question",
      }),
      options
    );
    const unknownStyle = await handleSacredBharatEditionEvent(
      request({
        edition: "001",
        event: "share_clicked",
        eventId: "d".repeat(32),
        playerToken: "a".repeat(24),
        score: 4,
        style: "future-style",
      }),
      options
    );

    expect(unknownEdition.status).toBe(400);
    expect(unknownQuestion.status).toBe(400);
    expect(unknownStyle.status).toBe(400);
    expect(calls).toBe(0);
  });

  test("filters link previews and prefetches before rate limiting or Convex", async () => {
    configureGateway();
    let calls = 0;
    const options = {
      fetchMutationImpl: mutationStub({}, () => {
        calls += 1;
      }),
      rateLimitKey: () => {
        calls += 1;
        return Promise.resolve("e".repeat(64));
      },
    };

    const linkPreview = await handleSacredBharatEditionEvent(
      request(validEvent(), { "User-Agent": "facebookexternalhit/1.1" }),
      options
    );
    const prefetch = await handleSacredBharatEditionEvent(
      request(validEvent(), { Purpose: "prefetch" }),
      options
    );

    expect(linkPreview.status).toBe(202);
    expect(await linkPreview.json()).toEqual({ accepted: true, filtered: true });
    expect(prefetch.status).toBe(202);
    expect(await prefetch.json()).toEqual({ accepted: true, filtered: true });
    expect(calls).toBe(0);
  });

  test("allows WhatsApp shares to record a real attributed edition start", async () => {
    configureGateway();
    let forwarded: JsonObject | undefined;
    const response = await handleSacredBharatEditionEvent(
      request(validEvent(), { "User-Agent": "WhatsApp/2.26.18 i" }),
      {
        fetchMutationImpl: mutationStub({}, (args) => {
          forwarded = args;
        }),
        rateLimitKey,
      }
    );

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ accepted: true });
    expect(forwarded).toMatchObject(validEvent());
  });

  test("fails closed without the server gateway and maps the durable Convex rate limit", async () => {
    mutableEnv.NODE_ENV = "production";
    mutableEnv.SITE_URL = "http://localhost";
    setEnv("BETTER_AUTH_URL", undefined);
    setEnv("NEXT_PUBLIC_APP_URL", undefined);
    setEnv("NEXT_PUBLIC_SITE_URL", undefined);
    setEnv("NEXT_PUBLIC_CONVEX_URL", undefined);
    setEnv("SACRED_BHARAT_EVENT_GATEWAY_SECRET", undefined);
    const unconfigured = await handleSacredBharatEditionEvent(request(validEvent()), {
      fetchMutationImpl: mutationStub({}),
    });
    configureGateway();
    const rateLimitedMutation: MutationStub = () =>
      Promise.reject(
        new ConvexError({
          kind: "RateLimited",
          name: "sacredBharatEditionEvent",
          retryAfter: 90_000,
        })
      );
    const throttled = await handleSacredBharatEditionEvent(request(validEvent()), {
      fetchMutationImpl: rateLimitedMutation,
      rateLimitKey,
    });

    expect(unconfigured.status).toBe(503);
    expect(throttled.status).toBe(429);
    expect(throttled.headers.get("retry-after")).toBe("90");
  });
});
