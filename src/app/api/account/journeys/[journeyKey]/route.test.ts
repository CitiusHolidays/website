import { beforeEach, describe, expect, mock, test } from "bun:test";
import { createAccountJourneyUrlKey } from "@/lib/accountJourneyUrlKey.server";
import type { JsonValue } from "@/lib/jsonValue";

const BOOKING_ID = "bookings_private_record_1";
const JOURNEY_KEY = createAccountJourneyUrlKey(BOOKING_ID);
let authToken: string | null = "account-token";
let summaries: Array<{ booking: { id: string } }> = [];
let detail: JsonValue = null;
const queryCalls: Array<{ args: JsonValue; options: JsonValue }> = [];

mock.module("@/lib/auth-server", () => ({
  fetchAuthQuery: (_query: JsonValue, args: JsonValue, options: JsonValue) => {
    queryCalls.push({ args, options });
    return queryCalls.length === 1 ? { referenceNow: 1, summaries } : detail;
  },
  getToken: () => authToken,
}));

const { GET } = await import("./route");

function request(key = JOURNEY_KEY) {
  return GET(new Request(`http://localhost/api/account/journeys/${key}`), {
    params: Promise.resolve({ journeyKey: key }),
  });
}

beforeEach(() => {
  authToken = "account-token";
  summaries = [];
  detail = null;
  queryCalls.length = 0;
});

describe("Customer Account journey detail route", () => {
  test("denies unauthenticated requests before resolving a URL selector", async () => {
    authToken = null;
    const response = await request();

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ error: "Authentication required" });
    expect(queryCalls).toEqual([]);
  });

  test("rejects malformed and raw private identifiers before a backend read", async () => {
    const response = await request(BOOKING_ID);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid journey link" });
    expect(queryCalls).toEqual([]);
  });

  test("returns the same private 404 for stale and unauthorized opaque selectors", async () => {
    const response = await request();

    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ error: "Journey not found" });
    expect(queryCalls).toHaveLength(1);
    expect(queryCalls[0].options).toEqual({ token: "account-token" });
  });

  test("rechecks detail entitlement after resolving the authorized summary", async () => {
    summaries = [{ booking: { id: BOOKING_ID } }];
    detail = null;
    const response = await request();

    expect(response.status).toBe(404);
    expect(queryCalls).toHaveLength(2);
    expect(queryCalls[1]).toEqual({
      args: { bookingId: BOOKING_ID, referenceNow: expect.any(Number) },
      options: { token: "account-token" },
    });
  });

  test("returns authorized detail privately without putting its booking id in the URL", async () => {
    summaries = [{ booking: { id: BOOKING_ID } }];
    detail = { booking: { id: BOOKING_ID }, trip: { name: "Kailash Journey" } };
    const response = await request();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.url).not.toContain(BOOKING_ID);
    expect(await response.json()).toEqual(detail);
  });
});
