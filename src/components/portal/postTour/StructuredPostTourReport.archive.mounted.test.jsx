import { afterAll, afterEach, beforeAll, expect, mock, test } from "bun:test";
import { emptyPostTourReport } from "@convex/lib/postTourReportContent";
import { JSDOM } from "jsdom";
import { act } from "react";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  pretendToBeVisual: true,
  url: "https://citius.test",
});
const mutations = [];
const dialogs = [];
let archiveFails = false;
mock.module("@convex/_generated/api", () => ({
  api: {
    crm: {
      postTourReports: { archive: "archive", saveDraft: "saveDraft", submit: "submit" },
    },
  },
}));
mock.module("convex/react", () => ({
  useMutation: (reference) => (args) => {
    mutations.push([reference, args]);
    return reference === "archive" && archiveFails
      ? Promise.reject(new Error("offline"))
      : Promise.resolve({ id: "report-1", revision: 1 });
  },
}));
mock.module("@/components/portal/PortalConfirmDialog", () => ({
  usePortalConfirm: () => ({
    confirm: async ({ onConfirm, ...options }) => {
      dialogs.push(options);
      await onConfirm();
    },
  }),
}));

let createRoot, root, StructuredPostTourReport;
beforeAll(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  for (const name of [
    "window",
    "document",
    "HTMLElement",
    "HTMLInputElement",
    "HTMLTextAreaElement",
    "HTMLSelectElement",
    "Element",
    "Node",
    "Event",
    "MouseEvent",
    "MutationObserver",
  ]) {
    globalThis[name] = dom.window[name] ?? dom.window;
  }
  globalThis.getComputedStyle = dom.window.getComputedStyle;
  ({ createRoot } = await import("react-dom/client"));
  ({ StructuredPostTourReport } = await import("./StructuredPostTourReport"));
});
afterEach(async () => {
  if (root) {
    await act(() => root.unmount());
  }
  root = null;
  mutations.length = 0;
  dialogs.length = 0;
  archiveFails = false;
  document.body.replaceChildren();
});
afterAll(() => {
  mock.restore();
  dom.window.close();
});

const content = emptyPostTourReport({ client: "Synthetic group", destination: "Jaipur" });
const report = (id, overrides = {}) => ({
  canArchive: true,
  canEdit: true,
  canRestore: true,
  content,
  id,
  preparedBy: "Synthetic Operations",
  revision: 4,
  status: "draft",
  submittedAt: null,
  updatedAt: 1,
  ...overrides,
});
const workspace = (overrides = {}) => ({
  archived: [],
  canPrepare: true,
  initial: content,
  jobCardId: "job-archive",
  jobCode: "JC-ARCHIVE",
  report: null,
  viewerKey: "admin",
  viewerName: "Synthetic Admin",
  ...overrides,
});
async function mount(value) {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(() => root.render(<StructuredPostTourReport workspace={value} />));
  return host;
}
function button(host, label) {
  return [...host.querySelectorAll("button")].find((row) => row.textContent === label);
}

test("loading, missing and not-yet-prepared workspaces explain themselves", async () => {
  const host = await mount(undefined);
  expect(host.textContent).toBe("Loading the internal report...");
  await act(() => root.render(<StructuredPostTourReport workspace={null} />));
  expect(host.textContent).toBe(
    "Select an available Job Card to read or prepare its internal report."
  );
  await act(() =>
    root.render(<StructuredPostTourReport workspace={workspace({ canPrepare: false })} />)
  );
  expect(host.querySelector("form")).toBeNull();
  expect(host.textContent).toContain("No submitted report yet.");
});

test("archive and restore confirm first, then send the expected revision", async () => {
  const host = await mount(
    workspace({
      archived: [report("report-old", { content: { ...content }, status: "archived" })],
      report: report("report-1"),
    })
  );
  expect(host.textContent).toContain("Synthetic Operations · Synthetic group");
  await act(async () => button(host, "Archive report").click());
  expect(dialogs[0]).toMatchObject({
    confirmLabel: "Archive report",
    danger: true,
    title: "Archive internal report?",
  });
  await act(async () => button(host, "Restore report").click());
  expect(dialogs[1]).toMatchObject({
    confirmLabel: "Restore report",
    danger: false,
    title: "Restore internal report?",
  });
  expect(mutations).toEqual([
    ["archive", { expectedRevision: 4, reportId: "report-1", restore: false }],
    ["archive", { expectedRevision: 4, reportId: "report-old", restore: true }],
  ]);
  expect(host.querySelector('[role="alert"]')).toBeNull();
});

test("a failed archive keeps the report and says nothing was removed", async () => {
  archiveFails = true;
  const host = await mount(workspace({ report: report("report-1") }));
  await act(async () => button(host, "Archive report").click());
  expect(host.querySelector('[role="alert"]').textContent).toBe(
    "The report could not be archived or restored. It has not been removed."
  );
  expect(host.querySelector("form")).not.toBeNull();
});
