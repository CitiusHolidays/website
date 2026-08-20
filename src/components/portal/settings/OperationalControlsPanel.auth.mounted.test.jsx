import { afterAll, afterEach, beforeAll, describe, expect, mock, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";

const queryCalls = [];
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/portal/settings",
});
let createRoot;
let OperationalControlsPanel;
let isAuthenticated = false;
let liveAccess;

mock.module("@convex/_generated/api", () => ({
  api: {
    crm: {
      settings: {
        activateOperationalControlPlane: "activateOperationalControlPlane",
        createOperationalTestOverride: "createOperationalTestOverride",
        getOperationalControlPlaneStatus: "getOperationalControlPlaneStatus",
        listOperationalControlAudit: "listOperationalControlAudit",
        listOperationalControls: "listOperationalControls",
        listOperationalEffectReceipts: "listOperationalEffectReceipts",
        listOperationalTestOverrides: "listOperationalTestOverrides",
        revokeOperationalTestOverride: "revokeOperationalTestOverride",
        rollbackOperationalControl: "rollbackOperationalControl",
        setOperationalControl: "setOperationalControl",
      },
      staff: { getMyPortalAccess: "getMyPortalAccess" },
    },
    sacredBharatEditionEvents: {
      getEdition001AttributionMetrics: "getEdition001AttributionMetrics",
    },
  },
}));

mock.module("convex/react", () => ({
  useConvexAuth: () => ({ isAuthenticated, isLoading: !isAuthenticated }),
  useMutation: () => async () => undefined,
  useQuery: (reference, args) => {
    queryCalls.push({ args, reference });
    return reference === "getMyPortalAccess" ? liveAccess : undefined;
  },
}));

mock.module("@/components/portal/PortalToast", () => ({
  usePortalToast: () => ({
    error: () => "toast-error",
    info: () => "toast-info",
    success: () => "toast-success",
  }),
}));

beforeAll(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  ({ createRoot } = await import("react-dom/client"));
  ({ OperationalControlsPanel } = await import("./OperationalControlsPanel"));
});

afterAll(() => {
  mock.restore();
  dom.window.close();
});

afterEach(() => {
  isAuthenticated = false;
  liveAccess = undefined;
  queryCalls.length = 0;
  document.body.replaceChildren();
});

describe("OperationalControlsPanel authentication boundary", () => {
  test("skips exact-Admin queries until the Convex client has authenticated", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => root.render(<OperationalControlsPanel />));

    expect(queryCalls).toHaveLength(7);
    expect(queryCalls.every(({ args }) => args === "skip")).toBe(true);

    await act(async () => root.unmount());
    container.remove();
  });

  test("keeps protected queries skipped when the live Convex identity is not an Admin", async () => {
    isAuthenticated = true;
    liveAccess = {
      allowed: true,
      roles: ["Directors"],
      staffId: "staff_director",
    };
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => root.render(<OperationalControlsPanel />));

    expect(queryCalls.find(({ reference }) => reference === "getMyPortalAccess")?.args).toEqual({});
    expect(
      queryCalls
        .filter(({ reference }) => reference !== "getMyPortalAccess")
        .every(({ args }) => args === "skip")
    ).toBe(true);

    await act(async () => root.unmount());
    container.remove();
  });
});
