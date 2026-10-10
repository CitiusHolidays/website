import { afterAll, beforeAll, expect, mock, test } from "bun:test";
import { getFunctionName } from "convex/server";
import { JSDOM } from "jsdom";
import { act } from "react";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citius.test/portal/queries",
});
const pendingRoutes = [];
const noop = () => undefined;
const mutation = async () => undefined;
const rows = [
  {
    clientName: "Alpha",
    id: "alpha",
    leadStage: "New",
    paxCount: 10,
    queryCode: "Q-ALPHA",
    salesStatus: "New Query",
  },
  {
    clientName: "Bravo",
    id: "bravo",
    leadStage: "New",
    paxCount: 10,
    queryCode: "Q-BRAVO",
    salesStatus: "New Query",
  },
  {
    clientName: "Bravo",
    id: "lost-bravo",
    leadStage: "Lost",
    paxCount: 10,
    queryCode: "Q-LOST-BRAVO",
    salesStatus: "Order Lost",
  },
];
const router = {
  prefetch: noop,
  push: noop,
  replace: (url) => pendingRoutes.push(url),
};

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  for (const key of [
    "window",
    "document",
    "HTMLElement",
    "Element",
    "Node",
    "Event",
    "MouseEvent",
    "HTMLInputElement",
    "InputEvent",
    "MutationObserver",
  ]) {
    globalThis[key] = key === "window" ? dom.window : dom.window[key];
  }
  globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  globalThis.cancelAnimationFrame = clearTimeout;
  window.matchMedia = () => ({
    addEventListener: noop,
    addListener: noop,
    matches: false,
    removeEventListener: noop,
    removeListener: noop,
  });
  mock.module("next/navigation", () => ({
    usePathname: () => window.location.pathname,
    useRouter: () => router,
  }));
  mock.module("convex/react", () => ({
    useAction: () => mutation,
    useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
    useMutation: () => mutation,
    usePaginatedQuery: (reference, args) => ({
      loadMore: noop,
      results:
        args !== "skip" && getFunctionName(reference) === "crm/queries:listPage"
          ? rows.filter((row) => !args.search || row.clientName.includes(args.search))
          : [],
      status: "Exhausted",
    }),
    useQuery: (reference, args) =>
      args !== "skip" && getFunctionName(reference) === "crm/listSearch:getReadiness"
        ? {
            tables: {
              jobCards: true,
              proposals: true,
              queries: true,
              travellers: true,
            },
          }
        : undefined,
  }));
});

afterAll(() => {
  mock.restore();
  dom.window.close();
});

async function mountWorkspace(initialUrl = "/portal/queries") {
  pendingRoutes.length = 0;
  window.history.replaceState(null, "", initialUrl);
  const { createRoot } = await import("react-dom/client");
  const { PortalAccessProvider } = await import("@/components/portal/PortalAccessContext");
  const { PortalToastProvider } = await import("@/components/portal/PortalToast");
  const { PortalConfirmProvider } = await import("@/components/portal/PortalConfirmDialog");
  const { default: PortalListToolbar } = await import("@/components/portal/PortalListToolbar");
  const { usePortalWorkspaceState } = await import("@/components/portal/usePortalWorkspaceState");
  const { QueriesView } = await import("@/components/portal/workspace/QueriesView");
  const { PORTAL_PERMISSIONS: P } = await import("@/lib/portal/constants");
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  function Workspace() {
    const model = usePortalWorkspaceState("queries", new URLSearchParams(window.location.search));
    const { header } = model.chrome;
    return (
      <>
        <PortalListToolbar
          dateRange={header.dateRange}
          filtersActive={header.filtersActive}
          onClearAllFilters={header.clearAllFilters}
          search={header.search}
          setDateRange={header.setDateRangeWithUrl}
          setSearch={header.setSearchWithUrl}
          title="Queries"
        />
        <QueriesView {...model.route.content.props} />
      </>
    );
  }
  const render = () =>
    act(async () =>
      root.render(
        <PortalAccessProvider
          access={{
            allowed: true,
            permissions: [P.VIEW_QUERIES],
            roles: ["Sales"],
          }}
        >
          <PortalToastProvider>
            <PortalConfirmProvider>
              <Workspace />
            </PortalConfirmProvider>
          </PortalToastProvider>
        </PortalAccessProvider>
      )
    );
  await render();
  return {
    container,
    flushRoutes: () =>
      pendingRoutes.splice(0).reduce(
        (previous, url) =>
          previous.then(async () => {
            window.history.replaceState(null, "", url);
            await render();
          }),
        Promise.resolve()
      ),
    render,
    unmount: async () => {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

async function enterSearch(container, value) {
  const input = container.querySelector('[aria-label="Search this page"]');
  await act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, value);
    input.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        data: value,
        inputType: "insertText",
      })
    );
  });
}

test("Clearing search before its URL update settles keeps the search empty and restores Query rows", async () => {
  const workspace = await mountWorkspace();
  try {
    expect(workspace.container.textContent).toContain("Q-ALPHA");
    expect(workspace.container.textContent).toContain("Q-BRAVO");
    await enterSearch(workspace.container, "Alpha");
    expect(workspace.container.textContent).toContain("Q-ALPHA");
    expect(workspace.container.textContent).not.toContain("Q-BRAVO");
    await enterSearch(workspace.container, "");
    await workspace.flushRoutes();
    await workspace.render();
    expect(workspace.container.querySelector('[aria-label="Search this page"]').value).toBe("");
    expect(window.location.search).toBe("");
    expect(workspace.container.textContent).toContain("Q-ALPHA");
    expect(workspace.container.textContent).toContain("Q-BRAVO");
  } finally {
    await workspace.unmount();
  }
});

test("Clear filters restores all Query rows when search navigation has not settled", async () => {
  const workspace = await mountWorkspace();
  try {
    await enterSearch(workspace.container, "Alpha");
    expect(workspace.container.textContent).not.toContain("Q-BRAVO");
    const clear = [...workspace.container.querySelectorAll("button")].find(
      (button) => button.textContent === "Clear filters"
    );
    await act(async () => clear.click());
    await workspace.flushRoutes();
    await workspace.render();
    expect(workspace.container.querySelector('[aria-label="Search this page"]').value).toBe("");
    expect(window.location.search).toBe("");
    expect(workspace.container.textContent).toContain("Q-ALPHA");
    expect(workspace.container.textContent).toContain("Q-BRAVO");
  } finally {
    await workspace.unmount();
  }
});

test("Consecutive searches retain the latest term, recognized route context and hash", async () => {
  const workspace = await mountWorkspace(
    "/portal/queries?open=query&id=alpha&tab=rooming#query-table"
  );
  try {
    await enterSearch(workspace.container, "Alpha");
    await enterSearch(workspace.container, "Bravo");
    await workspace.flushRoutes();
    await workspace.render();
    expect(workspace.container.querySelector('[aria-label="Search this page"]').value).toBe(
      "Bravo"
    );
    expect(workspace.container.textContent).not.toContain("Q-ALPHA");
    expect(workspace.container.textContent).toContain("Q-BRAVO");
    expect(Object.fromEntries(new URLSearchParams(window.location.search))).toEqual({
      id: "alpha",
      open: "query",
      q: "Bravo",
      tab: "rooming",
    });
    expect(window.location.hash).toBe("#query-table");
    await enterSearch(workspace.container, "");
    await workspace.flushRoutes();
    await workspace.render();
    expect(Object.fromEntries(new URLSearchParams(window.location.search))).toEqual({
      id: "alpha",
      open: "query",
      tab: "rooming",
    });
    expect(window.location.hash).toBe("#query-table");
    expect(workspace.container.textContent).toContain("Q-ALPHA");
    expect(workspace.container.textContent).toContain("Q-BRAVO");
  } finally {
    await workspace.unmount();
  }
});

async function navigateHistory(workspace, direction) {
  await new Promise((resolve) => {
    window.addEventListener("popstate", resolve, { once: true });
    window.history[direction]();
  });
  await workspace.render();
}

test("Linked search and browser Back and Forward restore visible Query membership", async () => {
  const workspace = await mountWorkspace("/portal/queries?q=Alpha");
  try {
    expect(workspace.container.querySelector('[aria-label="Search this page"]').value).toBe(
      "Alpha"
    );
    expect(workspace.container.textContent).toContain("Q-ALPHA");
    expect(workspace.container.textContent).not.toContain("Q-BRAVO");
    window.history.pushState(null, "", "/portal/queries?q=Bravo");
    await workspace.render();
    expect(workspace.container.querySelector('[aria-label="Search this page"]').value).toBe(
      "Bravo"
    );
    expect(workspace.container.textContent).toContain("Q-BRAVO");
    expect(workspace.container.textContent).not.toContain("Q-ALPHA");
    await navigateHistory(workspace, "back");
    expect(workspace.container.querySelector('[aria-label="Search this page"]').value).toBe(
      "Alpha"
    );
    expect(workspace.container.textContent).toContain("Q-ALPHA");
    expect(workspace.container.textContent).not.toContain("Q-BRAVO");
    await navigateHistory(workspace, "forward");
    expect(workspace.container.querySelector('[aria-label="Search this page"]').value).toBe(
      "Bravo"
    );
    expect(workspace.container.textContent).toContain("Q-BRAVO");
    expect(workspace.container.textContent).not.toContain("Q-ALPHA");
    await enterSearch(workspace.container, "");
    await workspace.flushRoutes();
    await workspace.render();
    expect(workspace.container.textContent).toContain("Q-ALPHA");
    expect(workspace.container.textContent).toContain("Q-BRAVO");
  } finally {
    await workspace.unmount();
  }
});

test("A late search event from the old workspace cannot change the new route", async () => {
  const workspace = await mountWorkspace();
  try {
    expect(workspace.container.textContent).toContain("Q-ALPHA");
    window.history.pushState(null, "", "/portal/job-cards?q=Booked#job-table");
    await enterSearch(workspace.container, "Alpha");
    await workspace.flushRoutes();
    expect(`${window.location.pathname}${window.location.search}${window.location.hash}`).toBe(
      "/portal/job-cards?q=Booked#job-table"
    );
  } finally {
    await workspace.unmount();
  }
});

test("Rapid search and history-scope changes retain the latest Query filters", async () => {
  const workspace = await mountWorkspace();
  try {
    await enterSearch(workspace.container, "Alpha");
    const lost = [...workspace.container.querySelectorAll("button")].find(
      (button) => button.textContent === "Lost queries"
    );
    await act(async () => lost.click());
    await enterSearch(workspace.container, "Bravo");
    await workspace.flushRoutes();
    await workspace.render();
    expect(workspace.container.querySelector('[aria-label="Search this page"]').value).toBe(
      "Bravo"
    );
    expect(Object.fromEntries(new URLSearchParams(window.location.search))).toEqual({
      f_salesStatus: "Order Lost",
      q: "Bravo",
    });
    expect(workspace.container.textContent).toContain("Q-LOST-BRAVO");
    expect(workspace.container.textContent).not.toContain("Q-BRAVO");
    const active = [...workspace.container.querySelectorAll("button")].find(
      (button) => button.textContent === "Active queries"
    );
    await act(async () => active.click());
    await workspace.flushRoutes();
    await workspace.render();
    expect(Object.fromEntries(new URLSearchParams(window.location.search))).toEqual({ q: "Bravo" });
    expect(workspace.container.textContent).toContain("Q-BRAVO");
    expect(workspace.container.textContent).not.toContain("Q-LOST-BRAVO");
  } finally {
    await workspace.unmount();
  }
});
