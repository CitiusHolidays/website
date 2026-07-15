import { beforeEach, describe, expect, mock, test } from "bun:test";

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
let requireAuthRedirect = null;
const redirectUrls = [];

mock.module("next/navigation", () => ({
  redirect: (url) => {
    redirectUrls.push(url);
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

mock.module("@/lib/auth-server", () => ({
  fetchAuthMutation: async () => {},
  fetchAuthQuery: async () => currentAccess,
  requireAuth: async () => {
    if (requireAuthRedirect) {
      throw new Error(`NEXT_REDIRECT:${requireAuthRedirect}`);
    }
    return { session: { user: currentUser }, user: currentUser };
  },
}));

mock.module("@/components/portal/PortalShell", () => ({
  default: () => null,
}));

mock.module("@/components/providers/ReducedMotionProvider", () => ({
  default: ({ children }) => children,
}));

const { default: PortalLayout } = await import("./layout.js");

beforeEach(() => {
  currentUser = salesUser;
  currentAccess = salesAccess;
  requireAuthRedirect = null;
  redirectUrls.length = 0;
});

async function getRenderedShellProps() {
  const layout = await PortalLayout({ children: null });
  return layout.props.children.props;
}

describe("portal layout guard", () => {
  test("evaluates Sales and Operations portal access separately per request", async () => {
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

  test("redirects unauthorized staff away from portal deep links", async () => {
    currentAccess = { allowed: false, permissions: [], roles: [] };

    await expect(PortalLayout({ children: null })).rejects.toThrow(
      "NEXT_REDIRECT:/account?portal=unauthorized"
    );
    expect(redirectUrls).toEqual(["/account?portal=unauthorized"]);
  });

  test("preserves unauthenticated requireAuth redirect for direct portal URLs", async () => {
    requireAuthRedirect =
      "/auth/connect?callbackUrl=%2Fportal%2Fqueries%3Fopen%3DsalesDecision%26id%3Dquery_1";

    await expect(PortalLayout({ children: null })).rejects.toThrow("NEXT_REDIRECT:/auth/connect");
    expect(redirectUrls).toHaveLength(0);
  });
});
