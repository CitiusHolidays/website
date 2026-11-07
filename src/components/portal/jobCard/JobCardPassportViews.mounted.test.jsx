import { afterAll, beforeAll, beforeEach, expect, mock, test } from "bun:test";
import { getFunctionName } from "convex/server";
import { JSDOM } from "jsdom";
import { act } from "react";

// Synthetic people and ids only.
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citius.test/portal/job-cards/jc-1",
});
let access;
let serverAllows;
let log;
let logSubscriptions;
let checks;
mock.module("convex/react", () => ({
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
}));
mock.module("@/lib/portal/trackedConvexSubscriptions", () => ({
  useTrackedPaginatedQuery: (_query, args) => {
    logSubscriptions.push(args);
    return log;
  },
  useTrackedQuery: (query, args) => {
    if (getFunctionName(query) === "crm/staff:getMyPortalAccess") {
      return access;
    }
    if (args === "skip") {
      return;
    }
    checks.push(args);
    return serverAllows;
  },
}));
beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  for (const key of ["window", "document", "HTMLElement", "Element", "Node", "Event"]) {
    globalThis[key] = key === "window" ? dom.window : dom.window[key];
  }
});
beforeEach(() => {
  logSubscriptions = [];
  checks = [];
  serverAllows = true;
  log = {
    loadMore: () => undefined,
    results: [
      {
        accessedAt: Date.parse("2026-11-10T18:45:00Z"),
        actorName: "Asha Rao",
        batchLabel: "JC-01 / B01",
        id: "audit-2",
        travellerId: "t-1",
        travellerName: "Synthetic Traveller",
      },
      {
        accessedAt: Date.parse("2026-11-10T04:30:00Z"),
        actorName: "Kiran Das",
        batchLabel: null,
        id: "audit-1",
        travellerId: "t-2",
        travellerName: "Synthetic Guest",
      },
    ],
    status: "CanLoadMore",
  };
});
afterAll(() => {
  mock.restore();
  dom.window.close();
});

async function mount() {
  const { createRoot } = await import("react-dom/client");
  const { JobCardPassportViews } = await import("./JobCardPassportViews");
  const node = document.createElement("div");
  document.body.append(node);
  const root = createRoot(node);
  await act(() => {
    root.render(<JobCardPassportViews jobCardId="jc-1" />);
  });
  return {
    node,
    unmount: async () => {
      await act(() => root.unmount());
      node.remove();
    },
  };
}

const staff = (roles, extra = {}) => ({ allowed: true, roles, ...extra });

for (const [label, caller] of [
  ["Operations Head", staff(["Operations Head"])],
  ["Admin", staff(["Admin"])],
]) {
  test(`shows the ${label} who opened which passport, when (IST) and in which series`, async () => {
    access = caller;
    const view = await mount();
    const text = view.node.textContent;
    expect(view.node.querySelector("h2")?.textContent).toBe("Passport views");
    expect(text).toContain("Asha Rao opened Synthetic Traveller’s passport");
    // 18:45 UTC on 10 Nov is 00:15 IST on 11 Nov.
    expect(text).toContain("11/11/2026, 00:15 IST · JC-01 / B01");
    expect(text).toContain("Kiran Das opened Synthetic Guest’s passport");
    expect(text).toContain("10/11/2026, 10:00 IST");
    expect(text).toContain("Records are kept for one year after the trip.");
    expect(text.indexOf("Asha Rao")).toBeLessThan(text.indexOf("Kiran Das"));
    expect(view.node.querySelector("button")?.textContent).toBe("Show more passport views");
    expect(logSubscriptions).toEqual([{ jobCardId: "jc-1" }]);
    await view.unmount();
  });
}

test("shows an empty state to the Operations Head when nothing was opened", async () => {
  access = staff(["Operations Head"]);
  log = { loadMore: () => undefined, results: [], status: "Exhausted" };
  const view = await mount();
  expect(view.node.textContent).toContain(
    "No passports have been opened in the tour manager app for this Job Card."
  );
  expect(view.node.querySelector("button")).toBeNull();
  await view.unmount();
});

for (const [label, caller] of [
  ["a Director", staff(["Directors"])],
  ["an Operations executive", staff(["Operations"])],
  ["a tour manager", staff(["Tour Manager"])],
  ["an external tour manager login", staff(["Operations Head"], { externalTourManager: true })],
  ["a caller still loading", undefined],
]) {
  test(`shows ${label} nothing and never reads the log`, async () => {
    access = caller;
    const view = await mount();
    expect(view.node.textContent).toBe("");
    expect(view.node.innerHTML).toBe("");
    expect(checks).toEqual([]);
    expect(logSubscriptions).toEqual([]);
    await view.unmount();
  });
}

test("shows nothing when the server refuses this Job Card, or while it is still deciding", async () => {
  access = staff(["Admin"]);
  for (const answer of [false, undefined]) {
    serverAllows = answer;
    // biome-ignore lint/performance/noAwaitInLoops: each answer mounts and unmounts its own panel.
    const view = await mount();
    expect(view.node.innerHTML).toBe("");
    expect(logSubscriptions).toEqual([]);
    await view.unmount();
  }
  expect(checks).toEqual([{ jobCardId: "jc-1" }, { jobCardId: "jc-1" }]);
});
