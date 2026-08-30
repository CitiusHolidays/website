import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { PORTAL_PERMISSIONS as P } from "@/lib/portal/constants";

const exportRetryCalls = [];
let exportRetryShouldFail = false;

const baseItem = {
  ageMs: 60_000,
  freshness: "recent",
  owner: { kind: "initiator", label: "Initiating staff member" },
  updatedAt: Date.parse("2026-08-30T15:59:00.000Z"),
};

const resultsBySource = {
  job_card_deletion: [
    {
      ...baseItem,
      href: "/portal/job-cards#deletion-status",
      id: "job_card_deletion:cleanup_1",
      owner: { kind: "job_card_admin", label: "Job Card admin" },
      readiness: "manual_review",
      source: "job_card_deletion",
      status: "failed",
      summary: "Cleanup for JC-1 stopped after removing 4 records.",
    },
  ],
  notification_email: [
    {
      ...baseItem,
      href: "/portal/job-cards/job_1",
      id: "notification_email:event_1",
      owner: { kind: "notification_owner", label: "Notification owner" },
      readiness: "manual_review",
      source: "notification_email",
      status: "exhausted",
      summary: "Assignment email: 1 exhausted and 0 retrying of 1 email deliveries.",
    },
  ],
  passenger_export: [
    {
      ...baseItem,
      href: "/portal/job-cards/job_1",
      id: "passenger_export:export_1",
      readiness: "retry_available",
      retry: {
        commandId: "018fbe7a-62c8-7f35-9d2f-2d3f53f9e301",
        exportKind: "traveller",
        jobCardId: "job_1",
        kind: "passenger_export",
      },
      source: "passenger_export",
      status: "retryable",
      summary: "JC-1 traveller export stopped after 4 rows.",
    },
  ],
  passenger_import: [
    {
      ...baseItem,
      href: "/portal/job-cards/job_1",
      id: "passenger_import:import_1",
      readiness: "source_required",
      source: "passenger_import",
      status: "partial",
      summary: "Passenger import for JC-1 has 2 unresolved of 4 rows.",
    },
  ],
  workflow_nudge: [
    {
      ...baseItem,
      href: "/portal/recovery#workflow-automation",
      id: "workflow_nudge:run_1",
      owner: { kind: "workflow_admin", label: "Workflow admin" },
      readiness: "manual_review",
      source: "workflow_nudge",
      status: "failed",
      summary: "Workflow reminders stopped after checking 20 records.",
    },
  ],
};

mock.module("convex/react", () => ({
  useAction: () => (args) => {
    exportRetryCalls.push(args);
    if (exportRetryShouldFail) {
      return Promise.reject(new Error("Retry unavailable"));
    }
    return Promise.resolve({ operationId: "export_1" });
  },
}));

mock.module("@/lib/portal/trackedConvexSubscriptions", () => ({
  useTrackedPaginatedQuery: (_query, args) => ({
    loadMore: () => undefined,
    results: resultsBySource[args.source] ?? [],
    status: "Exhausted",
  }),
}));

mock.module("next/link", () => ({
  default: ({ children, href, ...props }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const { RecoveryCenterView } = await import("./RecoveryCenterView");

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/portal/recovery",
});

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  globalThis.Event = dom.window.Event;
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

function button(container, label) {
  return [...container.querySelectorAll("button")].find(
    (candidate) => candidate.textContent.trim() === label
  );
}

describe("Mounted Recovery Center", () => {
  test("keeps privileged source tabs out of a Sales view", async () => {
    const mounted = await mount(
      <RecoveryCenterView access={{ permissions: [P.VIEW_DASHBOARD], roles: ["Sales"] }} />
    );
    expect(mounted.container.textContent).toContain("My imports");
    expect(mounted.container.textContent).toContain("My exports");
    expect(mounted.container.textContent).not.toContain("Job Card cleanup");
    expect(mounted.container.textContent).not.toContain("Notification email");
    expect(mounted.container.textContent).not.toContain("Workflow reminders");
    await mounted.unmount();
  });

  test("never renders a retry control for unsafe cleanup or exhausted email work", async () => {
    const mounted = await mount(
      <RecoveryCenterView
        access={{
          permissions: [P.VIEW_DASHBOARD, P.MANAGE_JOB_CARDS, P.VIEW_EMAIL_DELIVERY_STATUS],
          roles: ["Operations Head"],
        }}
      />
    );
    await act(async () => button(mounted.container, "Job Card cleanup").click());
    expect(mounted.container.textContent).toContain("Cleanup for JC-1 stopped");
    expect(button(mounted.container, "Retry safely")).toBeUndefined();
    expect(
      mounted.container.querySelector('a[href="/portal/job-cards#deletion-status"]')
    ).not.toBeNull();

    await act(async () => button(mounted.container, "Notification email").click());
    expect(mounted.container.textContent).toContain("1 exhausted");
    expect(button(mounted.container, "Retry safely")).toBeUndefined();
    await mounted.unmount();
  });

  test("replays the exact export command and announces acceptance", async () => {
    exportRetryCalls.length = 0;
    const mounted = await mount(
      <RecoveryCenterView
        access={{ permissions: [P.VIEW_DASHBOARD, P.VIEW_TRAVELLERS], roles: ["Sales"] }}
      />
    );
    await act(async () => button(mounted.container, "My exports").click());
    await act(async () => button(mounted.container, "Retry safely").click());

    expect(exportRetryCalls).toEqual([
      {
        commandId: "018fbe7a-62c8-7f35-9d2f-2d3f53f9e301",
        exportKind: "traveller",
        jobCardId: "job_1",
      },
    ]);
    expect(mounted.container.textContent).toContain(
      "Replay-safe retry accepted. Progress will update on refresh."
    );
    await mounted.unmount();
  });

  test("announces a rejected retry without hiding the owning workflow", async () => {
    exportRetryShouldFail = true;
    const mounted = await mount(
      <RecoveryCenterView
        access={{ permissions: [P.VIEW_DASHBOARD, P.VIEW_TRAVELLERS], roles: ["Sales"] }}
      />
    );
    await act(async () => button(mounted.container, "My exports").click());
    await act(async () => button(mounted.container, "Retry safely").click());

    expect(mounted.container.textContent).toContain(
      "Retry was not accepted. Refresh this record and review its owning workflow."
    );
    expect(mounted.container.querySelector('a[href="/portal/job-cards/job_1"]')).not.toBeNull();
    exportRetryShouldFail = false;
    await mounted.unmount();
  });

  test("keeps workflow recovery read-only without exposing a generic retry", async () => {
    const mounted = await mount(
      <RecoveryCenterView
        access={{
          permissions: [P.VIEW_DASHBOARD, P.MANAGE_STAFF],
          roles: ["Directors"],
        }}
      />
    );
    await act(async () => button(mounted.container, "Workflow reminders").click());

    expect(mounted.container.textContent).toContain("Manual review required");
    expect(button(mounted.container, "Retry safely")).toBeUndefined();
    expect(
      mounted.container.querySelector('a[href="/portal/recovery#workflow-automation"]')
    ).not.toBeNull();
    expect(mounted.container.textContent).not.toContain("scheduled");
    await mounted.unmount();
  });
});
