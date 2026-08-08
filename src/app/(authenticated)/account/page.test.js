import { beforeEach, describe, expect, mock, test } from "bun:test";

let tokenAcquisitions = 0;
const authOptions = [];

mock.module("next/server", () => ({ connection: () => undefined }));
mock.module("@/lib/auth-server", () => ({
  fetchAuthMutation: (_mutation, _args, options) => {
    authOptions.push(options);
  },
  fetchAuthQuery: (_query, _args, options) => {
    authOptions.push(options);
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
});

describe("Customer Travel Account request authentication", () => {
  test("exchanges one token and reuses it for profile and journey reads", async () => {
    await AccountPage();

    expect(tokenAcquisitions).toBe(1);
    expect(authOptions).toEqual([
      { token: "account-request-token" },
      { token: "account-request-token" },
      { token: "account-request-token" },
      { token: "account-request-token" },
    ]);
  });
});
