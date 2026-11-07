import { beforeEach, describe, expect, mock, test } from "bun:test";

let tokenAcquisitions = 0;
const authOptions = [];
const queryArgs = [];

mock.module("next/server", () => ({ connection: () => undefined }));
mock.module("@/lib/auth-server", () => ({
  fetchAuthMutation: (_mutation, _args, options) => {
    authOptions.push(options);
    return { status: "linked" };
  },
  fetchAuthQuery: (_query, args, options) => {
    authOptions.push(options);
    queryArgs.push(args);
    return [];
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
mock.module("./page.client.js", () => ({ default: () => null }));

const { default: AccountPage } = await import("./page.js");

beforeEach(() => {
  tokenAcquisitions = 0;
  authOptions.length = 0;
  queryArgs.length = 0;
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
});

describe("Customer Travel Account tab links", () => {
  test("Opens Settings from the account-deletion link and ignores unknown tabs", async () => {
    const settings = await AccountPage({ searchParams: Promise.resolve({ tab: "settings" }) });
    const unknown = await AccountPage({ searchParams: Promise.resolve({ tab: "admin" }) });
    const none = await AccountPage();

    expect(settings.props.initialTab).toBe("settings");
    expect(unknown.props.initialTab).toBe("journeys");
    expect(none.props.initialTab).toBe("journeys");
  });
});
