import { afterAll, beforeAll, expect, mock, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citius.test/portal/job-cards/jc-1",
});
let headcounts;
let announcements;
mock.module("@/lib/portal/trackedConvexSubscriptions", () => ({
  useTrackedPaginatedQuery: () => announcements,
  useTrackedQuery: () => headcounts,
}));
beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  for (const key of ["window", "document", "HTMLElement", "Element", "Node", "Event"]) {
    globalThis[key] = key === "window" ? dom.window : dom.window[key];
  }
});
afterAll(() => {
  mock.restore();
  dom.window.close();
});

async function mount() {
  const { createRoot } = await import("react-dom/client");
  const { JobCardFieldUpdates } = await import("./JobCardFieldUpdates");
  const node = document.createElement("div");
  document.body.append(node);
  const root = createRoot(node);
  await act(() => {
    root.render(<JobCardFieldUpdates jobCardId="jc-1" />);
  });
  return {
    node,
    unmount: async () => {
      await act(() => root.unmount());
      node.remove();
    },
  };
}

test("renders nothing when the caller has no office field access", async () => {
  headcounts = null;
  announcements = { loadMore: () => undefined, results: [], status: "Exhausted" };
  const view = await mount();
  expect(view.node.textContent).toBe("");
  await view.unmount();
});

test("shows the latest stop, X of Y present, who is missing and announcements", async () => {
  headcounts = [
    {
      day: "2026-11-10",
      latest: [
        {
          batchLabel: "JC-01 / B01",
          expectedCount: 3,
          id: "stop-1",
          label: "Temple gate",
          missing: [{ fullName: "Synthetic Traveller", id: "t-3" }],
          missingCount: 1,
          presentCount: 2,
          recordedByName: "Asha Rao",
          startedAt: Date.parse("2026-11-10T04:30:00Z"),
          travelBatchId: "b-1",
          updatedAt: Date.parse("2026-11-10T04:31:00Z"),
        },
      ],
      stopCount: 2,
    },
  ];
  announcements = {
    loadMore: () => undefined,
    results: [
      {
        authorName: "Asha Rao",
        batchLabel: "",
        body: "Coach leaves at 08:00.",
        id: "ann-1",
        recipientCount: 3,
        seenCount: 1,
        sharedAt: Date.parse("2026-11-10T02:00:00Z"),
        travelBatchId: null,
        updatedAt: Date.parse("2026-11-10T02:00:00Z"),
      },
    ],
    status: "Exhausted",
  };
  const view = await mount();
  const text = view.node.textContent ?? "";
  expect(text).toContain("Field updates");
  expect(text).toContain("Temple gate");
  expect(text).toContain("2 of 3 present");
  expect(text).toContain("Missing: Synthetic Traveller");
  expect(text).toContain("2 stops");
  expect(text).toContain("Coach leaves at 08:00.");
  expect(text).toContain("Whole group · Seen by 1 of 3");
  await view.unmount();
});
