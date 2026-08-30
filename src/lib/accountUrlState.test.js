import { describe, expect, test } from "bun:test";
import { createAccountJourneyUrlKey } from "./accountJourneyUrlKey.server";
import { accountUrlFor, parseAccountUrlState, resolveAccountUrlState } from "./accountUrlState";

const JOURNEY_KEY = createAccountJourneyUrlKey("bookings_private_record_1");
const JOURNEY_KEY_PATTERN = /^j_[A-Za-z0-9_-]{22}$/;

describe("Customer Account URL state", () => {
  test("serializes only the settled tab and opaque journey contract", () => {
    expect(accountUrlFor({ tab: "profile" })).toBe("/account?tab=profile");
    expect(accountUrlFor({ journeyKey: JOURNEY_KEY, tab: "journeys" })).toBe(
      `/account?tab=journeys&journey=${JOURNEY_KEY}`
    );
    expect(accountUrlFor({ journeyKey: "bookings_private_record_1", tab: "journeys" })).toBe(
      "/account?tab=journeys"
    );
  });

  test("rejects malformed, duplicate, and out-of-contract browser state", () => {
    for (const query of [
      "tab=staff",
      "tab=journeys&journey=bookings_private_record_1",
      "tab=journeys&journey=j_invalid",
      "tab=profile&journey=j_1234567890123456789012",
      "tab=journeys&tab=profile",
      "tab=journeys&privateEmail=traveller%40example.com",
      "portal=staff",
      "portal=unauthorized&tab=profile",
      "portal=unauthorized&portal=unauthorized",
    ]) {
      expect(parseAccountUrlState(new URLSearchParams(query))).toMatchObject({
        journeyKey: null,
        needsCanonicalization: true,
        recovery: "link-unavailable",
      });
    }
  });

  test("preserves the exact Staff access-denial redirect without treating it as a journey error", () => {
    expect(resolveAccountUrlState(new URLSearchParams("portal=unauthorized"), [])).toEqual({
      journeyKey: null,
      needsCanonicalization: false,
      recovery: null,
      tab: "journeys",
    });
  });

  test("resolves a journey key only from the current authorized projection", () => {
    const query = new URLSearchParams(`tab=journeys&journey=${JOURNEY_KEY}`);
    expect(resolveAccountUrlState(query, [{ journeyKey: JOURNEY_KEY }])).toMatchObject({
      journeyKey: JOURNEY_KEY,
      needsCanonicalization: false,
      recovery: null,
    });
    expect(resolveAccountUrlState(query, [])).toEqual({
      journeyKey: null,
      needsCanonicalization: true,
      recovery: "link-unavailable",
      tab: "journeys",
    });
  });

  test("derives a stable selector without embedding the private booking id", () => {
    expect(JOURNEY_KEY).toMatch(JOURNEY_KEY_PATTERN);
    expect(createAccountJourneyUrlKey("bookings_private_record_1")).toBe(JOURNEY_KEY);
    expect(JOURNEY_KEY).not.toContain("bookings_private_record_1");
  });
});
