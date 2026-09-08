import { afterAll, beforeAll, expect, mock, test } from "bun:test";
import { getFunctionName } from "convex/server";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { PORTAL_PERMISSIONS as P } from "@/lib/portal/constants";

const dom = new JSDOM("<!doctype html><html><body></body></html>");
const calls = [];
const loadMore = mock();
const emptyPage = { loadMore, results: [], status: "Exhausted" };
let proposalPage = { loadMore, results: [], status: "CanLoadMore" };

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  mock.module("@/lib/portal/trackedConvexSubscriptions", () => ({
    usePortalSubscriptionSummary: () => ({
      duplicateSubscriptions: 0,
      logicalSubscriptions: 0,
      subscriptions: [],
    }),
    useTrackedPaginatedQuery: (query, args) => {
      if (getFunctionName(query) === "crm/proposals:listPage") {
        calls.push(args);
        return proposalPage;
      }
      return emptyPage;
    },
    useTrackedQuery: () => undefined,
  }));
});

afterAll(() => {
  mock.restore();
  dom.window.close();
});

test("Sales Decision loads all pages for its exact Query independently of list search", async () => {
  const { usePortalWorkspaceData } = await import("./usePortalWorkspaceData");
  const input = {
    access: { roles: ["Sales"] },
    canFetch: true,
    deepLinkId: null,
    deepLinkOpen: null,
    deepLinkQueryId: null,
    form: { queryId: "query_4" },
    has: (permission) => permission === P.VIEW_PROPOSALS,
    jobCardFilter: "",
    listFilters: {},
    modal: "salesDecision",
    referenceNow: Date.now(),
    search: "unrelated search",
    view: "proposals",
  };
  function Probe() {
    const data = usePortalWorkspaceData(input);
    return <output>{JSON.stringify(data.proposals)}</output>;
  }
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () => root.render(<Probe />));
  expect(calls.at(-1)).toEqual({ queryId: "query_4" });
  expect(loadMore).toHaveBeenCalledTimes(1);
  proposalPage = { loadMore, results: [], status: "LoadingMore" };
  await act(async () => root.render(<Probe />));
  proposalPage = { loadMore, results: [], status: "CanLoadMore" };
  await act(async () => root.render(<Probe />));
  expect(loadMore).toHaveBeenCalledTimes(2);
  const proposal = {
    id: "proposal_1",
    queryId: "query_4",
    queryPreview: [{ id: "query_4", pairState: "With Sales" }],
  };
  proposalPage = { loadMore, results: [proposal], status: "Exhausted" };
  await act(async () => root.render(<Probe />));
  expect(JSON.parse(container.textContent)).toEqual([proposal]);
  expect(loadMore).toHaveBeenCalledTimes(2);
  await act(async () => root.unmount());
});
