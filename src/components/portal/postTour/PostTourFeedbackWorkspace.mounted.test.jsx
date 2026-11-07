import { afterAll, afterEach, beforeAll, expect, mock, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://citius.test" });
const queries = [];
const mutations = [];
const loads = [];
const state = {};
const page = (name, results, status) => ({
  loadMore: (count) => loads.push([name, count]),
  results,
  status,
});
const job = (jobCardId, canCompose = true) => ({
  canCompose,
  clientName: `Client ${jobCardId}`,
  destination: "Kochi",
  jobCardId,
  jobCode: `JC-${jobCardId}`,
  travelEndDate: "",
  travelStartDate: "2026-10-01",
});

mock.module("@convex/_generated/api", () => ({
  api: {
    crm: {
      postTourFeedback: {
        create: "create",
        getJobContext: "getJobContext",
        list: "list",
        listJobs: "listJobs",
        remove: "remove",
        removePhoto: "removePhoto",
        update: "update",
      },
      postTourReports: { workspace: "workspace" },
    },
  },
}));
mock.module("convex/react", () => ({
  useMutation: (reference) => (args) => {
    mutations.push([reference, args]);
    return Promise.resolve(null);
  },
  usePaginatedQuery: (reference, args) => {
    queries.push([reference, args]);
    return reference === "listJobs" ? state.jobs : state.feedback;
  },
  useQuery: (reference, args) => {
    queries.push([reference, args]);
    return reference === "workspace" ? state.structured : state.job;
  },
}));
mock.module("./StructuredPostTourReport", () => ({
  StructuredPostTourReport: ({ workspace }) => (
    <p data-view="report">{workspace ? workspace.jobCardId : String(workspace)}</p>
  ),
}));
mock.module("./TravelerFeedbackPanel", () => ({
  TravelerFeedbackPanel: ({ jobCardId }) => <p data-view="travellers">{jobCardId ?? "none"}</p>,
}));

let createRoot;
let PostTourFeedbackWorkspace;
let root;
beforeAll(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  for (const name of [
    "window",
    "document",
    "HTMLElement",
    "HTMLInputElement",
    "HTMLSelectElement",
    "HTMLTextAreaElement",
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
  ({ default: PostTourFeedbackWorkspace } = await import("./PostTourFeedbackWorkspace"));
});
afterEach(async () => {
  if (root) {
    await act(async () => root.unmount());
  }
  root = null;
  queries.length = 0;
  mutations.length = 0;
  loads.length = 0;
  document.body.replaceChildren();
});
afterAll(() => {
  mock.restore();
  dom.window.close();
});

async function mount(props = {}) {
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<PostTourFeedbackWorkspace {...props} />));
  return container;
}
function button(container, text) {
  return [...container.querySelectorAll("button")].find((item) => item.textContent === text);
}
function lastArgs(reference) {
  return queries.findLast(([name]) => name === reference)?.[1];
}

test("a report link resolves its Job Card, and choosing another card drops the link", async () => {
  state.structured = { jobCardId: "job-2" };
  state.job = job("job-2");
  state.jobs = page("jobs", [job("job-1"), job("job-2", false)], "CanLoadMore");
  state.feedback = page("feedback", [], "Exhausted");
  const container = await mount({ initialReportId: "report-1" });
  expect(lastArgs("workspace")).toEqual({ reportId: "report-1" });
  expect(lastArgs("getJobContext")).toEqual({ jobCardId: "job-2" });
  const select = container.querySelector("select");
  expect(select.value).toBe("job-2");
  expect(container.querySelector('[data-view="report"]').textContent).toBe("job-2");
  expect([...select.options].map((option) => option.textContent)).toEqual([
    "Choose a Job Card...",
    "JC-job-1 · Client job-1 · Assigned to you",
    "JC-job-2 · Client job-2",
  ]);
  await act(async () => button(container, "Load more Job Cards").click());
  expect(loads).toEqual([["jobs", 30]]);
  await act(() => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLSelectElement.prototype, "value").set.call(
      select,
      "job-1"
    );
    select.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  });
  expect(lastArgs("workspace")).toEqual({ jobCardId: "job-1" });
});

test("a Job Card outside the loaded list stays selectable, and a removed one is explained", async () => {
  state.structured = undefined;
  state.job = job("job-9");
  state.jobs = page("jobs", [job("job-1")], "LoadingMore");
  state.feedback = page("feedback", [], "Exhausted");
  const container = await mount({ initialJobCardId: "job-9", initialView: "travellers" });
  expect([...container.querySelector("select").options].map((option) => option.value)).toEqual([
    "",
    "job-9",
    "job-1",
  ]);
  expect(container.querySelector("select option").textContent).toBe("All Job Cards");
  expect(button(container, "Load more Job Cards").disabled).toBe(true);
  expect(container.querySelector('[data-view="travellers"]').textContent).toBe("job-9");
  state.job = null;
  await act(async () => root.render(<PostTourFeedbackWorkspace initialJobCardId="job-9" />));
  expect(container.textContent).toContain("This Job Card is no longer available.");
  expect(container.querySelector('[data-view="report"]')).toBeNull();
  expect(container.querySelector('[data-view="travellers"]').textContent).toBe("none");
});

test("team notes save against the chosen Job Card, page on demand and report a failed upload", async () => {
  state.structured = null;
  state.job = job("job-1");
  state.jobs = page("jobs", [job("job-1")], "Exhausted");
  state.feedback = page(
    "feedback",
    [
      {
        authorName: "Synthetic manager",
        canDelete: true,
        canEdit: true,
        category: "hotel",
        comment: "Quiet rooms.",
        createdAt: 1,
        id: "feedback-1",
        job: job("job-1"),
        photos: [],
        updatedAt: 1,
        vendorName: "",
        vendorRating: null,
      },
    ],
    "CanLoadMore"
  );
  const uploads = [];
  globalThis.fetch = (url, init) => {
    uploads.push([url, init.method, init.headers["Content-Type"]]);
    return Promise.resolve({ ok: false });
  };
  const container = await mount({ initialJobCardId: "job-1" });
  expect(button(container, "Load more Job Cards")).toBeUndefined();
  await act(async () => button(container, "Earlier team notes").click());
  expect(lastArgs("list")).toEqual({ jobCardId: "job-1" });
  await act(async () => button(container, "Load more feedback").click());
  expect(loads).toEqual([["feedback", 20]]);
  const textarea = container.querySelector("textarea");
  await act(() => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, "value").set.call(
      textarea,
      "Coach was late."
    );
    textarea.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  });
  await act(async () =>
    container
      .querySelector("form")
      .dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }))
  );
  expect(mutations).toEqual([
    [
      "create",
      {
        category: "overall",
        comment: "Coach was late.",
        jobCardId: "job-1",
        vendorName: "",
        vendorRating: null,
      },
    ],
  ]);
  const input = container.querySelector('input[type="file"]');
  Object.defineProperty(input, "files", {
    configurable: true,
    value: [new dom.window.File(["synthetic"], "coach one.png", { type: "image/png" })],
  });
  await act(async () => input.dispatchEvent(new dom.window.Event("change", { bubbles: true })));
  expect(uploads).toEqual([
    [
      "/api/portal/post-tour/photos?feedbackId=feedback-1&fileName=coach+one.png",
      "POST",
      "image/png",
    ],
  ]);
  expect(container.textContent).toContain("Photo upload failed. Your comments are saved.");
});

test("a reader without an assigned Job Card cannot save team notes", async () => {
  state.structured = null;
  state.job = undefined;
  state.jobs = page("jobs", [], "Exhausted");
  state.feedback = page("feedback", [], "LoadingFirstPage");
  const container = await mount({ initialView: "managers" });
  expect(lastArgs("list")).toEqual({});
  expect(lastArgs("getJobContext")).toBe("skip");
  expect(container.querySelector("form")).toBeNull();
  expect(container.textContent).toContain("Loading feedback...");
  expect(button(container, "Load more feedback")).toBeUndefined();
});
