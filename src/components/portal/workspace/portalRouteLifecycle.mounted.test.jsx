import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { getPortalDataDependencies } from "@/lib/portal/portalDataDependencies";
import { PORTAL_ROUTES, resolvePortalRoutePagination } from "@/lib/portal/portalRouteManifest";
import { PortalLoadingAnnouncement } from "../PortalLoadingAnnouncement";
import { WorkspacePagination } from "./PortalWorkspaceHeader";
import { PortalRouteLifecycleBoundary, renderPortalRoute } from "./portalRouteLifecycle";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/portal/dashboard",
});

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
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

function RouteLifecycleHarness({ deepLinkOpen, gate, modal, pagination, view }) {
  const dependencies = [...getPortalDataDependencies({ deepLinkOpen, modal, view })].sort();
  const activePagination = resolvePortalRoutePagination(view, pagination);
  return (
    <PortalRouteLifecycleBoundary gate={gate} view={view}>
      <output data-testid="dependencies">{dependencies.join(",")}</output>
      <span>Ready route: {view}</span>
      <WorkspacePagination pagination={activePagination} />
    </PortalRouteLifecycleBoundary>
  );
}

const PAGINATION = {
  activity: {},
  approvals: {},
  expenses: {},
  flightOperations: {},
  hotelOperations: {},
  invoices: {},
  jobCards: {},
  leaves: {},
  proposals: {},
  queries: {
    canLoadMore: true,
    isLoadingMore: false,
    loadedCount: 50,
    loadMore: () => undefined,
  },
  seats: {},
  staff: {},
  team: {},
  tickets: {},
  tourManagers: {},
  travellers: {},
  visas: {},
};

describe("mounted portal route lifecycle", () => {
  test("renders loading and denied gates before ready route content", async () => {
    const loading = await mount(
      <>
        <PortalLoadingAnnouncement />
        <RouteLifecycleHarness gate="loading" pagination={PAGINATION} view="queries" />
      </>
    );
    expect(loading.container.textContent).not.toContain("Ready route");
    expect(loading.container.textContent).toContain("Loading portal data");
    expect(loading.container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(loading.container.querySelectorAll("[data-portal-loading-announcer]")).toHaveLength(1);
    expect(loading.container.querySelector("[data-portal-loading-announcer]")?.textContent).toBe(
      "Loading Staff Workspace view"
    );
    await loading.unmount();

    const denied = await mount(
      <RouteLifecycleHarness gate="denied" pagination={PAGINATION} view="queries" />
    );
    expect(denied.container.textContent).toContain("No access to this portal page");
    expect(denied.container.textContent).not.toContain("Ready route");
    await denied.unmount();
  });

  test("renders a ready lifecycle for every route family and exposes its lazy component identity", async () => {
    const representativeRoutes = Object.entries(PORTAL_ROUTES).filter(
      ([, route], index, entries) =>
        entries.findIndex(([, candidate]) => candidate.family === route.family) === index
    );
    expect(representativeRoutes).toHaveLength(6);

    // The shared JSDOM root must be mounted and unmounted serially to prevent cross-route leakage.
    for (const [view, route] of representativeRoutes) {
      // biome-ignore lint/performance/noAwaitInLoops: serial DOM lifecycle is the behavior under test
      const mounted = await mount(
        <RouteLifecycleHarness gate="ready" pagination={PAGINATION} view={view} />
      );
      const boundary = mounted.container.querySelector("[data-portal-route-family]");
      expect(boundary?.getAttribute("data-portal-route-family")).toBe(route.family);
      expect(boundary?.getAttribute("data-portal-route-component")).toBe(route.component);
      expect(mounted.container.textContent).toContain(`Ready route: ${view}`);
      await mounted.unmount();
    }
  });

  test("renders a production route component through the manifest-owned lifecycle", async () => {
    const report = {
      locationHeadcount: [{ count: 4, id: "Delhi", location: "Delhi" }],
      revenueByType: [{ count: 3, queryType: "MICE", revenue: 250_000 }],
      summary: {
        confirmedQueries: 2,
        confirmedRevenue: 180_000,
        lostQueries: 1,
        totalPipelineBudget: 250_000,
      },
    };
    const mounted = await mount(
      <PortalRouteLifecycleBoundary gate="ready" view="reports">
        <Suspense fallback={<span>Loading report route</span>}>
          {renderPortalRoute("reports", { reports: report })}
        </Suspense>
      </PortalRouteLifecycleBoundary>
    );
    await act(async () => new Promise((resolve) => setTimeout(resolve, 20)));

    expect(mounted.container.textContent).toContain("Pipeline Budget");
    expect(mounted.container.textContent).toContain("Confirmed Revenue");
    expect(mounted.container.textContent).toContain("Revenue by query type");
    expect(
      mounted.container.querySelector('[data-portal-route-component="ReportsView"]')
    ).not.toBeNull();
    await mounted.unmount();
  });

  test("keeps deep-link subscriptions and active pagination inside the ready lifecycle", async () => {
    const mounted = await mount(
      <RouteLifecycleHarness
        deepLinkOpen="approval"
        gate="ready"
        modal="ticket"
        pagination={PAGINATION}
        view="queries"
      />
    );
    expect(mounted.container.querySelector('[data-testid="dependencies"]')?.textContent).toBe(
      "approvals,expenses,jobCards,pnrs,queries,tickets,travellers"
    );
    expect(mounted.container.textContent).toContain("50 authorized records loaded");
    expect(mounted.container.textContent).toContain("Load more records");
    await mounted.unmount();
  });
});
