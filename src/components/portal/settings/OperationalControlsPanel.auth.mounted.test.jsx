import { afterAll, afterEach, beforeAll, describe, expect, mock, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";

const queryCalls = [];
const actionCalls = [];
const mutationCalls = [];
const queryResults = new Map();
const paginatedResults = new Map();
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
      productionTestLab: {
        listActiveRuns: "listActiveRuns",
        listRecipes: "listRecipes",
        listRuns: "listRuns",
        resumeRun: "resumeRun",
        runRecipes: "runRecipes",
      },
      settings: {
        applyOperationalChangeSet: "applyOperationalChangeSet",
        getOperationalControlTargetIdentity: "getOperationalControlTargetIdentity",
        listOperationalChangeSets: "listOperationalChangeSets",
        listOperationalControlAudit: "listOperationalControlAudit",
        listOperationalControls: "listOperationalControls",
        listOperationalEffectReceipts: "listOperationalEffectReceipts",
        undoOperationalChangeSet: "undoOperationalChangeSet",
      },
      staff: { getMyPortalAccess: "getMyPortalAccess" },
    },
    sacredBharatEditionEvents: {
      getEdition001AttributionMetrics: "getEdition001AttributionMetrics",
    },
  },
}));

mock.module("convex/react", () => ({
  useAction: (reference) => (args) => {
    actionCalls.push({ args, reference });
    return Promise.resolve(queryResults.get(`${reference}:result`));
  },
  useConvexAuth: () => ({ isAuthenticated, isLoading: !isAuthenticated }),
  useMutation: (reference) => (args) => {
    mutationCalls.push({ args, reference });
    return Promise.resolve(queryResults.get(`${reference}:result`));
  },
  usePaginatedQuery: (reference, args) => {
    queryCalls.push({ args, reference });
    return (
      paginatedResults.get(reference) ?? {
        loadMore: () => undefined,
        results: [],
        status: "Exhausted",
      }
    );
  },
  useQuery: (reference, args) => {
    queryCalls.push({ args, reference });
    return reference === "getMyPortalAccess" ? liveAccess : queryResults.get(reference);
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
  actionCalls.length = 0;
  mutationCalls.length = 0;
  queryResults.clear();
  paginatedResults.clear();
  document.body.replaceChildren();
});

describe("OperationalControlsPanel authentication boundary", () => {
  test("skips exact-Admin queries until the Convex client has authenticated", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => root.render(<OperationalControlsPanel />));

    expect(queryCalls).toHaveLength(9);
    expect(queryCalls.every(({ args }) => args === "skip")).toBe(true);
    expect(container.textContent).toContain("Loading feature controls");

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

  test("wires staged Apply and Test Lab actions only after exact-Admin authorization", async () => {
    isAuthenticated = true;
    liveAccess = { allowed: true, roles: ["Admin"], staffId: "staff_admin" };
    queryResults.set("getOperationalControlTargetIdentity", {
      targetDeployment: "local-convex",
      targetEnvironment: "development",
      targetRevision: "working-tree",
    });
    queryResults.set("listOperationalControls", [
      {
        availability: "available",
        blockedBy: [],
        category: "AI",
        configuredState: "normal",
        dependencies: [],
        description: "Allow server-side Concierge requests.",
        effectiveEnabled: true,
        enforcement: "server gateway",
        key: "ai.concierge",
        label: "Citius Concierge",
        revision: 1,
        source: "configured_default",
        standardEnabled: true,
        state: "default",
      },
    ]);
    queryResults.set("listRecipes", [
      {
        controls: ["inbound.crm_intake"],
        description: "Validate inbound orchestration without writes.",
        id: "inbound_leads",
        label: "Inbound leads",
        recordedEffects: ["CRM write suppressed"],
      },
    ]);
    queryResults.set("listActiveRuns", []);
    queryResults.set("applyOperationalChangeSet:result", {
      auditEventId: "operationalControlAuditEvents_apply",
      changeSetId: "operationalControlChangeSets_apply",
      replayed: false,
    });
    queryResults.set("runRecipes:result", {
      replayed: false,
      run: { results: [] },
    });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(<OperationalControlsPanel />));

    const controlSwitch = container.querySelector('[role="switch"]');
    await act(async () =>
      controlSwitch.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
    );
    const reviewButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.startsWith("Review 1 staged")
    );
    await act(async () =>
      reviewButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
    );
    const reason = container.querySelector("textarea");
    await act(() => {
      const valueSetter = Object.getOwnPropertyDescriptor(
        dom.window.HTMLTextAreaElement.prototype,
        "value"
      )?.set;
      valueSetter.call(reason, "Pause Concierge during a provider investigation.");
      reason.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    });
    const applyButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Apply changes now"
    );
    await act(async () =>
      applyButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
    );
    expect(
      mutationCalls.find(({ reference }) => reference === "applyOperationalChangeSet")?.args
    ).toMatchObject({
      changes: [{ expectedRevision: 1, key: "ai.concierge", state: "disabled" }],
      expectedTargetDeployment: "local-convex",
      expectedTargetEnvironment: "development",
      expectedTargetRevision: "working-tree",
      reason: "Pause Concierge during a provider investigation.",
      restorationAt: null,
    });
    expect(container.textContent).toContain("operationalControlChangeSets_apply");
    expect(container.textContent).toContain("operationalControlAuditEvents_apply");
    expect(container.textContent).toContain("local-convex");

    const testTab = Array.from(container.querySelectorAll('[role="tab"]')).find(
      (button) => button.textContent === "Test Lab"
    );
    await act(async () =>
      testTab.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
    );
    const runButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.startsWith("Run 1 selected")
    );
    await act(async () =>
      runButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
    );
    expect(actionCalls.find(({ reference }) => reference === "runRecipes")?.args).toMatchObject({
      expectedTargetDeployment: "local-convex",
      expectedTargetEnvironment: "development",
      expectedTargetRevision: "working-tree",
      recipeIds: ["inbound_leads"],
    });

    await act(async () => root.unmount());
    container.remove();
  });
});
