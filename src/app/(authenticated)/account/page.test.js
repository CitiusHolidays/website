import { beforeEach, describe, expect, mock, test } from "bun:test";

let tokenAcquisitions = 0;
let identityStatus = "linked";
let mutationCalls = 0;
const authOptions = [];
const queryArgs = [];
const returnPaths = [];

function IdentityReviewMock() {
  return null;
}

mock.module("next/server", () => ({ connection: () => undefined }));
mock.module("@/lib/auth-server", () => ({
  fetchAuthMutation: (_mutation, _args, options) => {
    authOptions.push(options);
    mutationCalls += 1;
    return { status: identityStatus };
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
  requireAuth: (_callback, options, redirectOptions) => {
    authOptions.push(options);
    returnPaths.push(redirectOptions?.returnPath);
    return { user: { email: "guest@example.com", id: "auth_guest", name: "Guest" } };
  },
}));
mock.module("./page.client.js", () => ({ default: () => null }));
mock.module("@/components/account/AccountIdentityReview", () => ({
  default: IdentityReviewMock,
}));

const { default: AccountPage } = await import("./page.js");

beforeEach(() => {
  tokenAcquisitions = 0;
  identityStatus = "linked";
  mutationCalls = 0;
  authOptions.length = 0;
  queryArgs.length = 0;
  returnPaths.length = 0;
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

describe("Customer Travel Account sign-in and support states", () => {
  test("Sends a signed-out visitor back to the tab they asked for", async () => {
    await AccountPage({ searchParams: Promise.resolve({ tab: "settings" }) });
    await AccountPage({ searchParams: Promise.resolve({ tab: "admin" }) });

    expect(returnPaths).toEqual(["/account?tab=settings", "/account"]);
  });

  test("Shows the support state, not an error page, for an identity that needs review", async () => {
    identityStatus = "conflict";
    const page = await AccountPage();

    expect(page.type).toBe(IdentityReviewMock);
    // No profile is created and no journeys are read for an unlinked identity.
    expect(mutationCalls).toBe(1);
    expect(queryArgs).toEqual([]);
  });

  test("Explains the redirect from the Staff Workspace", async () => {
    const redirected = await AccountPage({
      searchParams: Promise.resolve({ portal: "unauthorized" }),
    });
    const direct = await AccountPage();

    expect(redirected.props.portalUnauthorized).toBe(true);
    expect(direct.props.portalUnauthorized).toBe(false);
  });
});
