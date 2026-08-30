import { afterAll, afterEach, beforeAll, describe, expect, mock, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";

const queryCalls = [];
const actionCalls = [];
const mutationCalls = [];
const toastCalls = [];
const queryResults = new Map();
const paginatedResults = new Map();
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/portal/settings",
});
let createRoot;
let OperationalControlsPanel;
let isAuthenticated = false;
let liveAccess;
const noop = () => undefined;

function readyCutoverPreview(restorationAfterMs = null) {
  return {
    blockers: [],
    effects: [],
    items: [],
    ready: true,
    referenceAt: Date.now(),
    restorationAfterMs,
    targetDeployment: "local-convex",
    targetEnvironment: "development",
    targetRevision: "working-tree",
    undoAvailableAfterApply: true,
  };
}

mock.module("@convex/_generated/api", () => ({
  api: {
    authEmailDeliveries: { getDeliveryHealth: "getDeliveryHealth" },
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
        getRuntimeHealth: "getRuntimeHealth",
        listOperationalChangeSets: "listOperationalChangeSets",
        listOperationalControlAudit: "listOperationalControlAudit",
        listOperationalControls: "listOperationalControls",
        listOperationalEffectReceipts: "listOperationalEffectReceipts",
        previewOperationalCutover: "previewOperationalCutover",
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
    const result = queryResults.get(`${reference}:result`);
    return result instanceof Error ? Promise.reject(result) : Promise.resolve(result);
  },
  useConvexAuth: () => ({ isAuthenticated, isLoading: !isAuthenticated }),
  useMutation: (reference) => (args) => {
    mutationCalls.push({ args, reference });
    const result = queryResults.get(`${reference}:result`);
    return result instanceof Error ? Promise.reject(result) : Promise.resolve(result);
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
    error: (message) => toastCalls.push(["error", message]),
    info: (message) => toastCalls.push(["info", message]),
    success: (message) => toastCalls.push(["success", message]),
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
  toastCalls.length = 0;
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

    expect(queryCalls).toHaveLength(12);
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

  test("loads read-only runtime evidence only on its exact-Admin tab and preserves refresh focus", async () => {
    isAuthenticated = true;
    liveAccess = { allowed: true, roles: ["Admin"], staffId: "staff_admin" };
    queryResults.set("getOperationalControlTargetIdentity", {
      targetDeployment: "preview-control-check",
      targetEnvironment: "preview",
      targetRevision: "abc1234",
    });
    queryResults.set("listOperationalControls", []);
    queryResults.set("getRuntimeHealth", {
      aiExperiences: [
        {
          coverage: "complete",
          grounding: { canonicalTool: 2, unknown: 1 },
          key: "concierge",
          label: "Citius Concierge",
          latency: {
            between2And8Seconds: 1,
            over8Seconds: 1,
            under2Seconds: 1,
            unknown: 0,
          },
          observedAt: Date.now(),
          outcomes: { completed: 2, failed: 1, interrupted: 0 },
          sampleSize: 3,
          status: "observed",
        },
        {
          coverage: "complete",
          grounding: { canonicalTool: 0, unknown: 0 },
          key: "journeyPlanner",
          label: "Journey Planner historical telemetry",
          latency: {
            between2And8Seconds: 0,
            over8Seconds: 0,
            under2Seconds: 0,
            unknown: 0,
          },
          observedAt: null,
          outcomes: { completed: 0, failed: 0, interrupted: 0 },
          sampleSize: 0,
          status: "unknown",
        },
      ],
      at: Date.now(),
      projections: [
        {
          key: "crm_metrics",
          label: "CRM metrics",
          observedAt: Date.now(),
          status: "ready",
          summary: "Existing application-owned evidence is current.",
        },
      ],
      scheduledJobs: [
        {
          key: "cleanup_ai_runtime",
          label: "AI runtime cleanup",
          observedAt: null,
          status: "not_observed",
          summary: "No application-owned evidence has been observed yet.",
        },
      ],
      workflowNudges: {
        key: "workflow_nudges",
        label: "CRM workflow nudges",
        observedAt: Date.now(),
        status: "degraded",
        summary: "Existing evidence reports a failure that needs review.",
      },
    });
    queryResults.set("getDeliveryHealth", {
      counts: {
        password_reset: {
          exhausted: 0,
          queued: 0,
          retrying: 0,
          sending: 0,
          sent: 1,
          skipped: 0,
        },
        verification: {
          exhausted: 0,
          queued: 0,
          retrying: 0,
          sending: 0,
          sent: 1,
          skipped: 0,
        },
      },
      coverage: "complete",
      effectsObserved: 2,
      intentsObserved: 2,
      recent: [],
      target: {
        targetDeployment: "preview-control-check",
        targetEnvironment: "preview",
        targetRevision: "abc1234",
      },
      window: { endedAt: Date.now(), startedAt: Date.now() - 86_400_000 },
    });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => root.render(<OperationalControlsPanel />));

    expect(
      queryCalls
        .filter(({ reference }) => reference === "getRuntimeHealth")
        .every(({ args }) => args === "skip")
    ).toBe(true);
    const healthTab = [...container.querySelectorAll('[role="tab"]')].find(
      (button) => button.textContent === "Runtime health"
    );
    await act(async () => healthTab.click());

    expect(
      queryCalls.find(({ args, reference }) => reference === "getRuntimeHealth" && args !== "skip")
        ?.args
    ).toEqual({ at: expect.any(Number) });
    const runtimeHealthArgs = queryCalls.find(
      ({ args, reference }) => reference === "getRuntimeHealth" && args !== "skip"
    )?.args;
    expect(
      queryCalls.find(({ args, reference }) => reference === "getDeliveryHealth" && args !== "skip")
        ?.args
    ).toEqual(runtimeHealthArgs);
    expect(container.textContent).toContain("Application runtime evidence");
    expect(container.textContent).toContain("not Convex platform or monitoring-provider status");
    expect(container.textContent).toContain("Ready");
    expect(container.textContent).toContain("Not observed");
    expect(container.textContent).toContain("Degraded");
    expect(container.textContent).toContain("Authentication email health");
    expect(container.textContent).toContain("2 recorded intents");
    expect(container.textContent).toContain("AI experience health");
    expect(container.textContent).toContain("Canonical tool 2; Unknown 1");
    expect(container.textContent).toContain("No retained events are available.");
    expect(container.textContent).not.toContain("retry job");

    const refreshButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "Refresh evidence"
    );
    refreshButton.focus();
    await act(async () => refreshButton.click());
    expect(document.activeElement).toBe(refreshButton);

    const activityButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Review activity"
    );
    await act(async () => activityButton.click());
    expect(
      queryCalls.filter(({ reference }) => reference === "getRuntimeHealth").at(-1)?.args
    ).toBe("skip");
    expect(
      queryCalls.filter(({ reference }) => reference === "getDeliveryHealth").at(-1)?.args
    ).toBe("skip");

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
    queryResults.set("previewOperationalCutover", readyCutoverPreview(1_800_000));
    queryResults.set("applyOperationalChangeSet:result", {
      auditEventId: "operationalControlAuditEvents_apply",
      changeSetId: "operationalControlChangeSets_apply",
      replayed: false,
      restorationAt: 1_777_777_777_777,
    });
    queryResults.set("runRecipes:result", {
      replayed: false,
      run: { results: [], status: "passed" },
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
    const restoration = [...container.querySelectorAll("select")].find((select) =>
      select.querySelector('option[value="30m"]')
    );
    await act(() => {
      const valueSetter = Object.getOwnPropertyDescriptor(
        dom.window.HTMLSelectElement.prototype,
        "value"
      )?.set;
      valueSetter.call(restoration, "30m");
      restoration.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    });
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
      restorationAfterMs: 1_800_000,
    });
    expect(container.textContent).toContain("operationalControlChangeSets_apply");
    expect(container.textContent).toContain("operationalControlAuditEvents_apply");
    expect(container.textContent).toContain("local-convex");
    expect(container.textContent).toContain("Restores");

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

  test("reports a target-stale Test Lab failure and leaves the run retryable", async () => {
    isAuthenticated = true;
    liveAccess = { allowed: true, roles: ["Admin"], staffId: "staff_admin" };
    queryResults.set("getOperationalControlTargetIdentity", {
      targetDeployment: "preview-control-check",
      targetEnvironment: "preview",
      targetRevision: "abc1234",
    });
    queryResults.set("listOperationalControls", []);
    queryResults.set("listRecipes", [
      {
        controls: ["inbound.crm_intake"],
        description: "Validate inbound orchestration without writes.",
        id: "inbound_leads",
        label: "Inbound leads",
      },
    ]);
    queryResults.set("listActiveRuns", []);
    queryResults.set("runRecipes:result", new Error("OPERATIONAL_CONTROL_TARGET_MISMATCH"));
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(<OperationalControlsPanel />));

    const testTab = [...container.querySelectorAll('[role="tab"]')].find(
      (button) => button.textContent === "Test Lab"
    );
    await act(async () => testTab.click());
    const runButton = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.startsWith("Run 1 selected")
    );
    await act(async () => runButton.click());

    expect(toastCalls).toEqual([
      ["error", expect.stringContaining("OPERATIONAL_CONTROL_TARGET_MISMATCH")],
    ]);
    expect(runButton.disabled).toBe(false);

    await act(async () => root.unmount());
    container.remove();
  });

  test("retains reviewed Apply inputs after a failure and succeeds on retry", async () => {
    isAuthenticated = true;
    liveAccess = { allowed: true, roles: ["Admin"], staffId: "staff_admin" };
    queryResults.set("getOperationalControlTargetIdentity", {
      targetDeployment: "preview-control-check",
      targetEnvironment: "preview",
      targetRevision: "abc1234",
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
    queryResults.set("previewOperationalCutover", readyCutoverPreview());
    queryResults.set("applyOperationalChangeSet:result", new Error("STALE_OPERATIONAL_CHANGE_SET"));
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(<OperationalControlsPanel />));

    await act(async () => container.querySelector('[role="switch"]').click());
    const review = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.startsWith("Review 1 staged")
    );
    await act(async () => review.click());
    const reason = container.querySelector("textarea");
    await act(() => {
      const valueSetter = Object.getOwnPropertyDescriptor(
        dom.window.HTMLTextAreaElement.prototype,
        "value"
      )?.set;
      valueSetter.call(reason, "Pause Concierge after reviewing provider health.");
      reason.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    });
    let apply = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Apply changes now"
    );
    await act(async () => apply.click());

    expect(toastCalls.at(-1)).toEqual([
      "error",
      expect.stringContaining("STALE_OPERATIONAL_CHANGE_SET"),
    ]);
    expect(container.querySelector("textarea")?.value).toBe(
      "Pause Concierge after reviewing provider health."
    );
    apply = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Apply changes now"
    );
    expect(apply.disabled).toBe(false);

    queryResults.set("applyOperationalChangeSet:result", {
      auditEventId: "operationalControlAuditEvents_retry",
      changeSetId: "operationalControlChangeSets_retry",
      replayed: false,
      restorationAt: null,
    });
    await act(async () => apply.click());
    expect(toastCalls.at(-1)).toEqual(["success", "1 feature change applied."]);
    expect(container.textContent).toContain("operationalControlChangeSets_retry");
    expect(container.textContent).not.toContain("Apply changes now");

    await act(async () => root.unmount());
    container.remove();
  });

  test("keeps failed Undo review retryable, sends exact arguments, and restores focus on success", async () => {
    isAuthenticated = true;
    liveAccess = { allowed: true, roles: ["Admin"], staffId: "staff_admin" };
    queryResults.set("getOperationalControlTargetIdentity", {
      targetDeployment: "preview-control-check",
      targetEnvironment: "preview",
      targetRevision: "abc1234",
    });
    queryResults.set("listOperationalControls", []);
    const changeSet = {
      _id: "operationalControlChangeSets_latest",
      appliedAt: Date.now(),
      appliedByName: "Admin User",
      auditEventId: "operationalControlAuditEvents_apply",
      changeCount: 1,
      changes: [
        {
          after: { state: "disabled" },
          before: { state: "default" },
          key: "ai.concierge",
        },
      ],
      reason: "Provider investigation.",
      status: "applied",
      targetDeployment: "preview-control-check",
      targetEnvironment: "preview",
      targetRevision: "abc1234",
      undoAvailable: true,
    };
    paginatedResults.set("listOperationalChangeSets", {
      loadMore: noop,
      results: [changeSet],
      status: "Exhausted",
    });
    for (const reference of ["listOperationalControlAudit", "listOperationalEffectReceipts"]) {
      paginatedResults.set(reference, { loadMore: noop, results: [], status: "Exhausted" });
    }
    queryResults.set("undoOperationalChangeSet:result", new Error("UNDO_NOT_LATEST"));
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(<OperationalControlsPanel />));

    const activityTab = [...container.querySelectorAll('[role="tab"]')].find(
      (button) => button.textContent === "Activity"
    );
    await act(async () => activityTab.click());
    const undoTrigger = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Undo latest change"
    );
    undoTrigger.focus();
    await act(async () => undoTrigger.click());
    const reason = container.querySelector("textarea");
    await act(() => {
      const valueSetter = Object.getOwnPropertyDescriptor(
        dom.window.HTMLTextAreaElement.prototype,
        "value"
      )?.set;
      valueSetter.call(reason, "Restore the previous provider state after review.");
      reason.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    });
    let confirm = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Undo this change now")
    );
    await act(async () => confirm.click());

    expect(mutationCalls.at(-1)).toMatchObject({
      args: {
        changeSetId: "operationalControlChangeSets_latest",
        expectedTargetDeployment: "preview-control-check",
        expectedTargetEnvironment: "preview",
        expectedTargetRevision: "abc1234",
        reason: "Restore the previous provider state after review.",
      },
      reference: "undoOperationalChangeSet",
    });
    expect(toastCalls.at(-1)).toEqual(["error", expect.stringContaining("UNDO_NOT_LATEST")]);
    expect(container.textContent).toContain("Undo this change now");

    queryResults.set("undoOperationalChangeSet:result", {
      auditEventId: "operationalControlAuditEvents_undo",
      changeSetId: changeSet._id,
      replayed: false,
    });
    confirm = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Undo this change now")
    );
    await act(async () => confirm.click());
    expect(toastCalls.at(-1)).toEqual([
      "success",
      "The latest change was undone and the previous state was restored.",
    ]);
    expect(container.textContent).not.toContain("Undo this change now");
    expect(document.activeElement).toBe(undoTrigger);

    await act(async () => root.unmount());
    container.remove();
  });
});
