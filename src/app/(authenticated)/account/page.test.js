import { beforeEach, describe, expect, mock, test } from "bun:test";
import { createAccountJourneyUrlKey } from "@/lib/accountJourneyUrlKey.server";

let tokenAcquisitions = 0;
const authOptions = [];
const queryArgs = [];
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
  requireAuth: (_callback, options) => {
    authOptions.push(options);
    return { user: { email: "guest@example.com", id: "auth_guest", name: "Guest" } };
  },
}));
const { default: AccountPage } = await import("./page.js");

beforeEach(() => {
  tokenAcquisitions = 0;
  authOptions.length = 0;
  queryArgs.length = 0;
  journeyResult = { referenceNow: 1, summaries: [] };
});

describe("Customer Travel Account request authentication", () => {
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
