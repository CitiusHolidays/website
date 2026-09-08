import { afterAll, beforeAll, expect, mock, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";

const dom = new JSDOM("<!doctype html><html><body></body></html>");
const pairs = Array.from({ length: 4 }, (_, index) => ({
  clientName: `Client ${index + 1}`,
  id: `query_${index + 1}`,
  pairState: "Draft",
  queryCode: `Q-${index + 1}`,
  queryType: "Group",
}));
const pageCalls = [];
const timelineCalls = [];
const loadMore = mock();
let page = { loadMore, results: pairs.slice(0, 3), status: "CanLoadMore" };

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  mock.module("@/lib/portal/trackedConvexSubscriptions", () => ({
    useTrackedPaginatedQuery: (_query, args) => {
      pageCalls.push(args);
      return page;
    },
  }));
  mock.module("convex/react", () => ({
    useMutation: () => mock(),
    useQuery: (_query, args) => {
      timelineCalls.push(args);
    },
  }));
});

afterAll(() => {
  mock.restore();
  dom.window.close();
});

test("loads pairs beyond the preview and keeps handoff and timeline bound to that Query", async () => {
  const { ProposalPairList } = await import("./ProposalPairLifecycle");
  const container = document.createElement("div");
  const root = createRoot(container);
  const handoff = mock();
  const render = () =>
    root.render(
      <ProposalPairList
        canApproveSend={false}
        canManage
        onHandoff={handoff}
        proposal={{ id: "proposal_1", proposalRevision: 3, queryPreview: pairs.slice(0, 3) }}
      />
    );
  const button = (label) =>
    [...container.querySelectorAll("button")].find((item) => item.textContent === label);
  await act(async () => render());
  expect(pageCalls).toHaveLength(0);
  expect(container.textContent).not.toContain("Q-4");
  await act(async () => button("Browse all linked Queries").click());
  expect(pageCalls.at(-1)).toEqual({ proposalId: "proposal_1" });
  await act(async () => button("Load more linked Queries").click());
  expect(loadMore).toHaveBeenCalledWith(10);
  page = { loadMore, results: pairs, status: "Exhausted" };
  await act(async () => render());
  expect(container.textContent).toContain("Q-4");
  expect(button("Load more linked Queries")).toBeUndefined();
  const handoffButtons = [...container.querySelectorAll("button")].filter(
    (item) => item.textContent === "Review & handoff revision 3"
  );
  await act(async () => handoffButtons[3].click());
  expect(handoff).toHaveBeenCalledWith("query_4");
  const [, , , details] = container.querySelectorAll("details");
  await act(() => {
    details.open = true;
    details.dispatchEvent(new dom.window.Event("toggle"));
  });
  expect(timelineCalls.at(-1)).toMatchObject({ proposalId: "proposal_1", queryId: "query_4" });
  await act(async () => root.unmount());
});
