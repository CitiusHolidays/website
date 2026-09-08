import { beforeEach, describe, expect, mock, test } from "bun:test";
import { createAccountJourneyUrlKey } from "@/lib/accountJourneyUrlKey.server";

let tokenAcquisitions = 0;
const authOptions = [];
const queryArgs = [];
const authCallbacks = [];
let requireLogin = false;
let journeyResult = { referenceNow: 1, summaries: [] };

mock.module("next/server", () => ({ connection: () => undefined }));
mock.module("@/lib/auth-server", () => ({
  fetchAuthMutation: (_mutation, _args, options) => {
    authOptions.push(options);
    return { status: "linked" };
  },
  fetchAuthQuery: (_query, args, options) => {
    authOptions.push(options);
    queryArgs.push(args);
    return "referenceNow" in args ? journeyResult : { continueCursor: "", isDone: true, page: [] };
  },
  getToken: () => {
    tokenAcquisitions += 1;
    return "account-request-token";
  },
  requireAuth: (callback, options) => {
    authCallbacks.push(callback);
    authOptions.push(options);
    if (requireLogin) {
      throw new Error("sign-in required");
    }
    return { user: { email: "guest@example.com", id: "auth_guest", name: "Guest" } };
  },
}));
const { default: AccountPage } = await import("./page.js");

beforeEach(() => {
  tokenAcquisitions = 0;
  authOptions.length = 0;
  queryArgs.length = 0;
  authCallbacks.length = 0;
  requireLogin = false;
  journeyResult = { referenceNow: 1, summaries: [] };
});

describe("Customer Travel Account request authentication", () => {
  const redirectJourneyKey = createAccountJourneyUrlKey("bookings_private_record_1");
  test.each([
    [{ tab: "settings" }, "/account?tab=settings"],
    [
      { journey: redirectJourneyKey, tab: "journeys" },
      `/account?tab=journeys&journey=${redirectJourneyKey}`,
    ],
    [{ journey: [redirectJourneyKey, "other"], tab: "journeys" }, "/account?tab=journeys"],
    [{ secret: "private", tab: "profile" }, "/account?tab=profile"],
  ])("preserves only validated Account context from %j", async (params, expected) => {
    requireLogin = true;
    await expect(AccountPage({ searchParams: Promise.resolve(params) })).rejects.toThrow(
      "sign-in required"
    );
    expect(authCallbacks.at(-1)).toBe(expected);
    expect(queryArgs).toEqual([]);
  });
  test("Exchanges one token and reuses it for profile and journey reads", async () => {
    await AccountPage();

    expect(tokenAcquisitions).toBe(1);
    expect(authOptions).toEqual([
      { token: "account-request-token" },
      { token: "account-request-token" },
      { token: "account-request-token" },
      { token: "account-request-token" },
      { token: "account-request-token" },
    ]);
    expect(queryArgs).toContainEqual({ paginationOpts: { cursor: null, numItems: 20 } });
  });

  test("Resolves an opaque journey URL only from the authorized Account projection", async () => {
    const bookingId = "bookings_private_record_1";
    const journeyKey = createAccountJourneyUrlKey(bookingId);
    journeyResult = { referenceNow: 1, summaries: [{ booking: { id: bookingId } }] };

    const authorized = await AccountPage({
      searchParams: Promise.resolve({ journey: journeyKey, tab: "journeys" }),
    });
    expect(authorized.props.initialUrlState).toMatchObject({
      journeyKey,
      needsCanonicalization: false,
      recovery: null,
    });
    expect(authorized.props.journeys.summaries[0].journeyKey).toBe(journeyKey);

    journeyResult = { referenceNow: 1, summaries: [] };
    const unauthorized = await AccountPage({
      searchParams: Promise.resolve({ journey: journeyKey, tab: "journeys" }),
    });
    expect(unauthorized.props.initialUrlState).toEqual({
      journeyKey: null,
      needsCanonicalization: true,
      recovery: "link-unavailable",
      tab: "journeys",
    });
  });
});
