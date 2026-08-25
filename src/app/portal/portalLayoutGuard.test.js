import { beforeEach, describe, expect, mock, test } from "bun:test";
import { readFileSync } from "node:fs";
import { Suspense } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const salesUser = {
  email: "sales@citiusholidays.com",
  id: "auth_sales",
  name: "Sales User",
};

const operationsUser = {
  email: "operations@citiusholidays.com",
  id: "auth_operations",
  name: "Operations User",
};

const salesAccess = {
  allowed: true,
  permissions: ["VIEW_QUERIES", "MANAGE_QUERIES"],
  roles: ["Sales"],
};

const operationsAccess = {
  allowed: true,
  permissions: ["VIEW_TRAVELLERS", "MANAGE_TRAVELLERS"],
  roles: ["Operations"],
};

let currentUser = salesUser;
let currentAccess = salesAccess;
let currentLoginUser = null;
let requireAuthRedirect = null;
const redirectUrls = [];
let tokenAcquisitions = 0;
const authOptions = [];
const callOrder = [];

function AuthLoginPageClientMock() {
  return null;
}

mock.module("next/navigation", () => ({
  redirect: (url) => {
    redirectUrls.push(url);
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

mock.module("next/server", () => ({
  connection: () => {
    callOrder.push("connection");
  },
}));

mock.module("@/lib/auth-server", () => ({
  fetchAuthMutation: (_mutation, _args, options) => {
    callOrder.push("identity-sync");
    authOptions.push(options);
  },
  fetchAuthQuery: (_query, _args, options) => {
    callOrder.push("portal-access");
    authOptions.push(options);
    return currentAccess;
  },
  getServerUser: () => {
    callOrder.push("session");
    return currentLoginUser;
  },
  getToken: () => {
    callOrder.push("token");
    tokenAcquisitions += 1;
    return "request-token";
  },
  requireAuth: (_callbackUrl, options) => {
    callOrder.push("require-auth");
    authOptions.push(options);
    if (requireAuthRedirect) {
      throw new Error(`NEXT_REDIRECT:${requireAuthRedirect}`);
    }
    return { session: { user: currentUser }, user: currentUser };
  },
}));

mock.module("@/components/auth/AuthLoginPageClient", () => ({
  default: AuthLoginPageClientMock,
}));

mock.module("@/lib/auth-errors", () => ({
  formatAuthCallbackError: (error) => error || "",
}));

mock.module("@/lib/auth-sign-in-targets", () => ({
  getAuthVariant: (id) => ({ href: id === "employee" ? "/portal" : "/account" }),
  getAuthVariantFromCallbackUrl: () => ({ authPath: "/auth/guest" }),
  getSignInAuthUrl: (id) => (id === "employee" ? "/auth/connect" : "/auth/guest"),
  VISIBLE_SIGN_IN_TARGETS: [
    { id: "employee", label: "Citius Connect" },
    { id: "guest", label: "Guest Connect" },
  ],
}));

mock.module("@/components/portal/PortalShell", () => ({
  default: () => null,
}));

mock.module("@/components/providers/ReducedMotionProvider", () => ({
  default: ({ children }) => children,
}));

mock.module("@/components/providers/PortalMotionThemeProvider", () => ({
  default: ({ children }) => children,
}));

const { default: PortalLayout } = await import("./layout.js");
const { default: PortalAuthBoundary } = await import("./PortalAuthBoundary.js");
const { default: PortalLoadingShell } = await import("@/components/portal/PortalLoadingShell");
const { default: AuthLoginLoadingShell } = await import("@/components/auth/AuthLoginLoadingShell");
const { createAuthLoginPage } = await import("@/lib/auth-login-pages");
const { default: LegacyAuthPage } = await import("@/app/(auth)/auth/page");

beforeEach(() => {
  currentUser = salesUser;
  currentAccess = salesAccess;
  currentLoginUser = null;
  requireAuthRedirect = null;
  redirectUrls.length = 0;
  tokenAcquisitions = 0;
  authOptions.length = 0;
  callOrder.length = 0;
});

async function getRenderedShellProps() {
  const boundary = await PortalAuthBoundary({ children: null });
  return boundary.props.children.props.children.props;
}

describe("Portal layout guard", () => {
  test("Streams a generic shell while request-time portal auth resolves", () => {
    const layout = PortalLayout({ children: null });

    expect(layout.type).toBe(Suspense);
    expect(layout.props.fallback.type).toBe(PortalLoadingShell);
    expect(layout.props.children.type).toBe(PortalAuthBoundary);

    const markup = renderToStaticMarkup(PortalLoadingShell());
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain("Loading Citius Connect");
    expect(markup).not.toContain("sales@citiusholidays.com");
    expect(markup).not.toContain("VIEW_QUERIES");
  });

  test("Keeps the streamed shell independent from auth and CRM modules", () => {
    const layoutSource = readFileSync(new URL("./layout.js", import.meta.url), "utf8");
    const loadingSource = readFileSync(
      new URL("../../components/portal/PortalLoadingShell.tsx", import.meta.url),
      "utf8"
    );

    expect(layoutSource).not.toContain("@/lib/auth-server");
    expect(layoutSource).not.toContain("PortalShell");
    expect(loadingSource).not.toContain('"use client"');
    expect(loadingSource).not.toContain("@convex");
    expect(loadingSource).not.toContain("auth-server");
    expect(loadingSource).not.toContain("PortalAccess");
  });

  test("Acquires one token and reuses it for every portal bootstrap call", async () => {
    await getRenderedShellProps();

    expect(tokenAcquisitions).toBe(1);
    expect(callOrder).toEqual([
      "connection",
      "token",
      "require-auth",
      "identity-sync",
      "portal-access",
    ]);
    expect(authOptions).toEqual([
      { token: "request-token" },
      { token: "request-token" },
      { token: "request-token" },
    ]);
  });

  test("Evaluates Sales and Operations portal access separately per request", async () => {
    const salesShellProps = await getRenderedShellProps();
    expect(salesShellProps.user.id).toBe("auth_sales");
    expect(salesShellProps.access.roles).toEqual(["Sales"]);

    currentUser = operationsUser;
    currentAccess = operationsAccess;
    const operationsShellProps = await getRenderedShellProps();
    expect(operationsShellProps.user.id).toBe("auth_operations");
    expect(operationsShellProps.access.roles).toEqual(["Operations"]);
    expect(operationsShellProps.access.permissions).toContain("VIEW_TRAVELLERS");
    expect(operationsShellProps.access).not.toEqual(salesAccess);
  });

  test("Redirects unauthorized staff away from portal deep links", async () => {
    currentAccess = { allowed: false, permissions: [], roles: [] };

    await expect(PortalAuthBoundary({ children: null })).rejects.toThrow(
      "NEXT_REDIRECT:/account?portal=unauthorized"
    );
    expect(redirectUrls).toEqual(["/account?portal=unauthorized"]);
  });

  test("Preserves unauthenticated requireAuth redirect for direct portal URLs", async () => {
    requireAuthRedirect =
      "/auth/connect?callbackUrl=%2Fportal%2Fqueries%3Fopen%3DsalesDecision%26id%3Dquery_1";

    await expect(PortalAuthBoundary({ children: null })).rejects.toThrow(
      "NEXT_REDIRECT:/auth/connect"
    );
    expect(redirectUrls).toHaveLength(0);
  });
});

describe("Auth login loading guard", () => {
  test("Renders a generic shell before the request-time session check", async () => {
    const page = createAuthLoginPage({
      searchParams: Promise.resolve({ error: "reviewed", mode: "signin" }),
      variantId: "employee",
    });

    expect(page.type).toBe(Suspense);
    expect(page.props.fallback.type).toBe(AuthLoginLoadingShell);
    expect(callOrder).toEqual([]);

    const resolved = await page.props.children.type(page.props.children.props);
    expect(callOrder).toEqual(["connection", "session"]);
    expect(resolved.type).toBe(AuthLoginPageClientMock);
    expect(resolved.props).toEqual({
      error: "reviewed",
      initialMode: "signin",
      variantId: "employee",
    });
  });

  test("Keeps authenticated-session redirects behind the request boundary", async () => {
    currentLoginUser = { id: "auth_staff" };
    const page = createAuthLoginPage({ searchParams: Promise.resolve({}), variantId: "employee" });

    await expect(page.props.children.type(page.props.children.props)).rejects.toThrow(
      "NEXT_REDIRECT:/portal"
    );
    expect(callOrder).toEqual(["connection", "session"]);
    expect(redirectUrls).toEqual(["/portal"]);
  });

  test("Keeps legacy /auth redirects visible instead of using a blank fallback", () => {
    const page = LegacyAuthPage({ searchParams: Promise.resolve({}) });

    expect(page.type).toBe(Suspense);
    expect(page.props.fallback.type).toBe(AuthLoginLoadingShell);
  });

  test("Keeps identity, callback, and destination data out of the shared fallback", () => {
    const loadingSource = readFileSync(
      new URL("../../components/auth/AuthLoginLoadingShell.js", import.meta.url),
      "utf8"
    );
    const fallback = AuthLoginLoadingShell();

    expect(fallback.props.title).toBe("Opening secure sign in");
    expect(fallback.props.children.props["aria-busy"]).toBe("true");
    expect(loadingSource).not.toContain("@convex");
    expect(loadingSource).not.toContain("auth-server");
    expect(loadingSource).not.toContain("callbackUrl");
    expect(loadingSource).not.toContain('"/portal"');
  });
});
