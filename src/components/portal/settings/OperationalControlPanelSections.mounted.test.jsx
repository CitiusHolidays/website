import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";

let createRoot;
let ChangeSetReviewPanel;
let OperationalActivity;
let OperationalControlCatalog;
let OperationalTargetBanner;
let ProductionTestLab;
let UndoReviewPanel;

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/portal/settings",
});

beforeAll(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Element = dom.window.Element;
  globalThis.Node = dom.window.Node;
  globalThis.Event = dom.window.Event;
  ({ createRoot } = await import("react-dom/client"));
  ({
    ChangeSetReviewPanel,
    OperationalActivity,
    OperationalControlCatalog,
    OperationalTargetBanner,
    ProductionTestLab,
    UndoReviewPanel,
  } = await import("./OperationalControlPanelSections"));
});

afterAll(() => dom.window.close());

async function mount(element) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(element));
  return {
    container,
    unmount: async () => {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

const control = {
  availability: "available",
  blockedBy: ["notifications.crm_bell"],
  category: "Contact",
  configuredState: "available",
  dependencies: ["notifications.crm_bell"],
  description: "Create the Sales bell alert for an inbound lead.",
  effectiveEnabled: false,
  enforcement: "Inbound notification plan",
  key: "inbound.sales_bell",
  label: "Inbound Sales bell",
  revision: 3,
  source: "prerequisite_disabled",
  standardEnabled: true,
  state: "enabled",
};
const noop = () => undefined;
const stagedControls = [];
const recordStagedControl = (row, state) => stagedControls.push([row.key, state]);
const controlLabels = new Map([
  ["inbound.sales_bell", "Inbound Sales bell"],
  ["notifications.crm_bell", "CRM bell notifications"],
]);

describe("Mounted live feature control sections", () => {
  test("shows the exact target instead of assuming every deployment is Production", async () => {
    const view = await mount(
      <OperationalTargetBanner
        identity={{
          targetDeployment: "preview-control-check",
          targetEnvironment: "preview",
          targetRevision: "abc1234",
        }}
      />
    );
    expect(view.container.textContent).toContain("preview-control-check");
    expect(view.container.textContent).toContain("abc1234");
    await view.unmount();
  });

  test("stages toggles from configured state while explaining dependency blocking", async () => {
    stagedControls.length = 0;
    const view = await mount(
      <OperationalControlCatalog
        controlLabels={controlLabels}
        controls={[control]}
        filter="all"
        onFilterChange={noop}
        onSearchChange={noop}
        onStage={recordStagedControl}
        search=""
        staged={new Map()}
      />
    );
    const toggle = view.container.querySelector('[role="switch"]');
    expect(toggle.getAttribute("aria-checked")).toBe("true");
    expect(view.container.textContent).toContain("Configured as Available");
    expect(view.container.textContent).toContain("CRM bell notifications");
    expect(view.container.textContent).not.toContain("notifications.crm_bell");
    await act(async () => toggle.click());
    expect(stagedControls).toEqual([["inbound.sales_bell", "disabled"]]);
    await view.unmount();
  });

  test("uses an unlimited multiline reason and a real restoration selector", async () => {
    const view = await mount(
      <ChangeSetReviewPanel
        allControls={[
          control,
          {
            ...control,
            blockedBy: [],
            dependencies: [control.key],
            key: "inbound.sales_email",
            label: "Inbound Sales email",
          },
        ]}
        changes={[{ control, state: "disabled" }]}
        controlLabels={controlLabels}
        identity={{
          targetDeployment: "preview-control-check",
          targetEnvironment: "preview",
          targetRevision: "abc1234",
        }}
        onApply={noop}
        onCancel={noop}
        onReasonChange={noop}
        onRestorationChange={noop}
        pending={false}
        reason={`Operational context\n${"detail ".repeat(100)}`}
        restoration="2h"
      />
    );
    const reason = view.container.querySelector("textarea");
    const restoration = view.container.querySelector("select");
    expect(reason.hasAttribute("maxlength")).toBe(false);
    expect(restoration.value).toBe("2h");
    expect(view.container.textContent).toContain("Available → Paused");
    expect(view.container.textContent).toContain("exact state");
    expect(view.container.textContent).toContain("preview-control-check");
    expect(view.container.textContent).toContain("Inbound Sales email unavailable");
    expect(view.container.firstElementChild?.className).toContain("sticky");
    expect(view.container.firstElementChild?.getAttribute("aria-busy")).toBe("false");
    expect(
      [...view.container.querySelectorAll("button")].every((button) =>
        button.className.includes("min-h-11")
      )
    ).toBe(true);
    await view.unmount();
  });

  test("offers multiple major-feature recipes without side-effect toggles", async () => {
    const recipes = [
      {
        controls: ["inbound.crm_intake"],
        description: "No lead is created.",
        id: "inbound_leads",
        label: "Inbound leads",
        recordedEffects: ["CRM write recorded"],
      },
      {
        controls: ["ai.concierge"],
        description: "No provider is called.",
        id: "concierge",
        label: "Citius Concierge",
        recordedEffects: ["Provider call recorded"],
      },
      {
        controls: ["jobs.cleanup_ai_runtime"],
        description: "Validate one selected scheduled dispatch without writes.",
        id: "scheduled_job:cleanup_ai_runtime",
        label: "Scheduled job — Cleanup AI Runtime",
      },
    ];
    const view = await mount(
      <ProductionTestLab
        activeRuns={[]}
        canLoadMore={false}
        history={[]}
        latestResults={null}
        note=""
        onLoadMore={noop}
        onNoteChange={noop}
        onResume={noop}
        onRun={noop}
        onToggle={noop}
        pending={false}
        recipes={recipes}
        selected={new Set(["inbound_leads", "scheduled_job:cleanup_ai_runtime"])}
      />
    );
    expect(view.container.querySelectorAll('input[type="checkbox"]')).toHaveLength(3);
    expect(view.container.querySelectorAll('input[type="checkbox"]:checked')).toHaveLength(2);
    expect(view.container.textContent).toContain("without sending email");
    expect(view.container.textContent).not.toContain("Test surface");
    await view.unmount();
  });

  test("keeps 390px, 20px-root, coarse-pointer, reduced-motion, and large evidence usable", async () => {
    const originalMatchMedia = window.matchMedia;
    const originalFontSize = document.documentElement.style.fontSize;
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    document.documentElement.style.fontSize = "20px";
    window.matchMedia = (query) => ({
      addEventListener: noop,
      matches: query.includes("pointer: coarse") || query.includes("prefers-reduced-motion"),
      media: query,
      removeEventListener: noop,
    });
    const toggled = [];
    const longEvidence = `Recording boundary ${"validated-without-live-effects ".repeat(40)}`;
    const view = await mount(
      <ProductionTestLab
        activeRuns={[]}
        canLoadMore={false}
        history={[]}
        latestResults={[
          {
            cleanup: "passed",
            detail: longEvidence,
            durationMs: 12,
            label: "Inbound leads",
            recipeId: "inbound_leads",
            recordedEffects: [longEvidence],
            status: "passed",
            steps: [
              {
                detail: longEvidence,
                id: "recording-boundary",
                label: "Recording boundary",
                status: "passed",
              },
            ],
          },
        ]}
        note=""
        onLoadMore={noop}
        onNoteChange={noop}
        onResume={noop}
        onRun={noop}
        onToggle={(id) => toggled.push(id)}
        pending={false}
        recipes={[
          {
            controls: ["inbound.crm_intake"],
            description: "No lead is created.",
            id: "inbound_leads",
            label: "Inbound leads",
          },
          {
            controls: ["jobs.cleanup_ai_runtime"],
            description: "No scheduled mutation runs.",
            id: "scheduled_job:cleanup_ai_runtime",
            label: "Cleanup AI Runtime",
          },
        ]}
        selected={new Set(["inbound_leads"])}
      />
    );

    const firstChoice = view.container.querySelector('input[type="checkbox"]');
    firstChoice.focus();
    expect(document.activeElement).toBe(firstChoice);
    await act(async () => firstChoice.click());
    expect(toggled).toEqual(["inbound_leads"]);
    expect(view.container.textContent).toContain("Major feature checks");
    const scheduledSummary = view.container.querySelector("details summary");
    expect(scheduledSummary?.className).toContain("min-h-11");
    expect(view.container.querySelector("label")?.className).toContain(
      "motion-reduce:transition-none"
    );
    expect(
      [...view.container.querySelectorAll("ul")].some((list) =>
        list.className.includes("overflow-wrap:anywhere")
      )
    ).toBe(true);
    expect(window.matchMedia("(pointer: coarse)").matches).toBe(true);
    expect(window.matchMedia("(prefers-reduced-motion: reduce)").matches).toBe(true);

    await view.unmount();
    window.matchMedia = originalMatchMedia;
    document.documentElement.style.fontSize = originalFontSize;
  });

  test("distinguishes a loading recipe catalog from an explicit empty revision", async () => {
    const loading = await mount(
      <ProductionTestLab
        activeRuns={[]}
        canLoadMore={false}
        history={[]}
        latestResults={null}
        note=""
        onLoadMore={noop}
        onNoteChange={noop}
        onResume={noop}
        onRun={noop}
        onToggle={noop}
        pending={false}
        recipes={undefined}
        selected={new Set(["inbound_leads"])}
      />
    );
    expect(loading.container.textContent).toContain("Loading available checks");
    expect(loading.container.firstElementChild?.getAttribute("aria-busy")).toBe("true");
    expect(
      [...loading.container.querySelectorAll("button")].find((button) =>
        button.textContent?.includes("Loading checks")
      )?.disabled
    ).toBe(true);
    await loading.unmount();

    const empty = await mount(
      <ProductionTestLab
        activeRuns={[]}
        canLoadMore={false}
        history={[]}
        latestResults={null}
        note=""
        onLoadMore={noop}
        onNoteChange={noop}
        onResume={noop}
        onRun={noop}
        onToggle={noop}
        pending={false}
        recipes={[]}
        selected={new Set()}
      />
    );
    expect(empty.container.textContent).toContain(
      "No Production Test Lab checks are available for this source revision"
    );
    expect(empty.container.textContent).toContain("No Test Lab runs yet");
    await empty.unmount();
  });

  test("locks immutable active-run inputs and exposes recovery", async () => {
    const resumed = [];
    const view = await mount(
      <ProductionTestLab
        activeRuns={[
          {
            _id: "productionTestRuns_active",
            actorName: "Admin User",
            recipeIds: ["inbound_leads"],
            startedAt: Date.now(),
            status: "running",
            targetDeployment: "preview-control-check",
            targetEnvironment: "preview",
            targetRevision: "abc1234",
          },
        ]}
        canLoadMore={false}
        history={[]}
        latestResults={null}
        note="Immutable note"
        onLoadMore={noop}
        onNoteChange={noop}
        onResume={(runId) => resumed.push(runId)}
        onRun={noop}
        onToggle={noop}
        pending={false}
        recipes={[
          {
            controls: ["inbound.crm_intake"],
            description: "No lead is created.",
            id: "inbound_leads",
            label: "Inbound leads",
          },
        ]}
        selected={new Set(["inbound_leads"])}
      />
    );
    expect(view.container.querySelector('input[type="checkbox"]')?.disabled).toBe(true);
    expect(view.container.querySelector("textarea")?.disabled).toBe(true);
    const resume = [...view.container.querySelectorAll("button")].find((button) =>
      button.textContent?.startsWith("Resume 1 check")
    );
    await act(async () => resume.click());
    expect(resumed).toEqual(["productionTestRuns_active"]);
    await view.unmount();
  });

  test("announces mixed results and keeps older evidence reachable", async () => {
    let loadCount = 0;
    const result = (status) => ({
      cleanup: "passed",
      detail: `${status} detail`,
      durationMs: 12,
      label: `${status} recipe`,
      recipeId: status === "passed" ? "inbound_leads" : `scheduled_job:${status}`,
      recordedEffects: status === "passed" ? ["CRM write suppressed"] : [],
      status,
      steps: [
        {
          detail: `${status} step detail`,
          id: `${status}-step`,
          label: `${status} step`,
          status,
        },
      ],
    });
    const view = await mount(
      <ProductionTestLab
        activeRuns={[]}
        canLoadMore={true}
        history={[]}
        latestResults={[result("passed"), result("failed"), result("skipped")]}
        note=""
        onLoadMore={() => {
          loadCount += 1;
        }}
        onNoteChange={noop}
        onResume={noop}
        onRun={noop}
        onToggle={noop}
        pending={false}
        recipes={[]}
        selected={new Set()}
      />
    );
    const liveResult = view.container.querySelector('[aria-live="polite"]');
    expect(liveResult?.textContent).toContain("Passed");
    expect(liveResult?.textContent).toContain("Failed");
    expect(liveResult?.textContent).toContain("Skipped");
    const loadMore = [...view.container.querySelectorAll("button")].find(
      (button) => button.textContent === "Load older tests"
    );
    expect(loadMore?.className).toContain("min-h-11");
    await act(async () => loadMore.click());
    expect(loadCount).toBe(1);
    await view.unmount();
  });

  test("shows apply, restoration, and Undo as separate immutable target-stamped events", async () => {
    const baseEvent = {
      actorName: "Admin User",
      changeSetId: "operationalControlChangeSets_1",
      changes: [
        {
          after: { state: "disabled" },
          before: { state: "default" },
          key: "inbound.sales_bell",
        },
      ],
      commandId: "11111111-1111-4111-8111-111111111111",
      createdAt: Date.parse("2026-08-20T12:00:00.000Z"),
      reason: "Investigate delayed notification delivery.",
      targetDeployment: "preview-control-check",
      targetEnvironment: "preview",
      targetRevision: "abc1234",
    };
    const view = await mount(
      <OperationalActivity
        audits={[
          { ...baseEvent, _id: "audit_apply", action: "change_set_applied" },
          {
            ...baseEvent,
            _id: "audit_restore",
            action: "change_set_restored",
            actorName: "Automatic restoration",
          },
          { ...baseEvent, _id: "audit_undo", action: "change_set_undone" },
        ]}
        canLoadMoreAudits={false}
        canLoadMoreChanges={false}
        canLoadMoreReceipts={false}
        changeSets={[]}
        controlLabels={controlLabels}
        onLoadMoreAudits={noop}
        onLoadMoreChanges={noop}
        onLoadMoreReceipts={noop}
        onRequestUndo={noop}
        receipts={[]}
      />
    );
    expect(view.container.textContent).toContain("Production Change Set applied");
    expect(view.container.textContent).toContain("Automatic restoration completed");
    expect(view.container.textContent).toContain("Latest change undone");
    expect(view.container.textContent).toContain("preview-control-check");
    expect(view.container.querySelectorAll("article")).toHaveLength(3);
    expect(view.container.textContent).not.toContain("Roll back");
    await view.unmount();
  });

  test("requires a fresh reason and exact-target review before the one-shot undo", async () => {
    const changeSet = {
      _id: "operationalControlChangeSets_undo",
      appliedAt: Date.now(),
      appliedByName: "Admin User",
      auditEventId: "operationalControlAuditEvents_apply",
      changeCount: 1,
      changes: [
        {
          after: { state: "disabled" },
          before: { state: "default" },
          key: "inbound.sales_bell",
        },
      ],
      reason: "Investigate notification delivery.",
      status: "applied",
      targetDeployment: "preview-control-check",
      targetEnvironment: "preview",
      targetRevision: "abc1234",
      undoAvailable: true,
    };
    const view = await mount(
      <UndoReviewPanel
        changeSet={changeSet}
        controlLabels={controlLabels}
        onCancel={noop}
        onConfirm={noop}
        onReasonChange={noop}
        pending={false}
        reason=""
      />
    );
    const undoButton = [...view.container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Undo this change now")
    );
    expect(undoButton?.disabled).toBe(true);
    expect(view.container.textContent).toContain("Normal behavior");
    expect(view.container.textContent).toContain("preview-control-check");
    expect(view.container.textContent).toContain("one-shot");
    await view.unmount();
  });
});
