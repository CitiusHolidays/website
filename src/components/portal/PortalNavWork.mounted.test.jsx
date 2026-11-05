import { afterAll, beforeAll, expect, mock, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { reportPortalDestinationReady } from "@/lib/portal/portalDestinationReady";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citius.test/portal",
});
let pathname = "/portal";
let snapshot;
let controls;
const calls = [];
const acknowledge = (args) => {
  calls.push(args);
  return Promise.resolve(null);
};
mock.module("next/navigation", () => ({ usePathname: () => pathname }));
mock.module("convex/react", () => ({
  useConvexAuth: () => ({ isAuthenticated: true }),
  useMutation: () => acknowledge,
}));
mock.module("@/lib/portal/trackedConvexSubscriptions", () => ({ useTrackedQuery: () => snapshot }));
beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  for (const key of [
    "window",
    "document",
    "HTMLElement",
    "Element",
    "Node",
    "Event",
    "MutationObserver",
  ]) {
    globalThis[key] = key === "window" ? dom.window : dom.window[key];
  }
});
afterAll(() => {
  mock.restore();
  dom.window.close();
});
function state(ids = ["old"], viewerKey = "staff-one") {
  return {
    byHref: { "/portal/queries": { complete: true, count: 3, eventIds: ids, newActivity: true } },
    viewerKey,
  };
}
async function mount(initial = state()) {
  calls.length = 0;
  pathname = "/portal";
  snapshot = initial;
  const { createRoot } = await import("react-dom/client");
  const { PortalNavWorkProvider, PortalNavWorkIndicator, usePortalNavWork } = await import(
    "./PortalNavWork"
  );
  const node = document.createElement("div");
  document.body.append(node);
  const root = createRoot(node);
  function Child() {
    controls = usePortalNavWork();
    return <PortalNavWorkIndicator hrefs={["/portal/queries"]} />;
  }
  const render = () =>
    act(async () =>
      root.render(
        <PortalNavWorkProvider allowed>
          <Child />
        </PortalNavWorkProvider>
      )
    );
  await render();
  return {
    close: async () => {
      await act(async () => root.unmount());
      node.remove();
    },
    node,
    render,
  };
}

test("sidebar render, hover-equivalent and failed navigation do not acknowledge; count and new activity remain separate", async () => {
  const view = await mount();
  expect(view.node.textContent).toContain("3 work items need attention");
  expect(view.node.textContent).toContain("New activity");
  expect(calls).toEqual([]);
  await act(async () => controls.startVisit("/portal/queries"));
  await act(async () => reportPortalDestinationReady("/portal/queries"));
  expect(calls).toEqual([]); // destination never became the current path
  await view.close();
});

test("successful ready navigation acknowledges only the captured IDs, preserving concurrent arrivals", async () => {
  const view = await mount();
  await act(async () => controls.startVisit("/portal/queries"));
  pathname = "/portal/queries";
  snapshot = state(["old", "racing-new"]);
  await view.render();
  expect(calls).toEqual([]);
  await act(async () => reportPortalDestinationReady("/portal/queries"));
  expect(calls).toEqual([
    { href: "/portal/queries", notificationIds: ["old"], viewerKey: "staff-one" },
  ]);
  snapshot = state(["old", "racing-new", "later"]);
  await view.render();
  await act(async () => reportPortalDestinationReady("/portal/queries"));
  expect(calls).toHaveLength(1);
  expect(view.node.textContent).toContain("3 work items");
  await act(async () => controls.startVisit("/portal/queries"));
  expect(calls[1].notificationIds).toEqual(["old", "racing-new", "later"]);
  await view.close();
});

test("refresh waits for loaded content and data; viewer changes require fresh content readiness", async () => {
  const view = await mount(undefined);
  pathname = "/portal/queries";
  snapshot = undefined;
  await view.render();
  await act(async () => reportPortalDestinationReady("/portal/queries"));
  expect(calls).toEqual([]);
  snapshot = state();
  await view.render();
  expect(calls).toHaveLength(1);
  snapshot = state(["other-person-event"], "staff-two");
  await view.render();
  expect(calls).toHaveLength(1);
  await act(async () => controls.startVisit("/portal/queries"));
  expect(calls).toHaveLength(1); // old person's ready state cannot clear another person's activity
  await act(async () => reportPortalDestinationReady("/portal/queries"));
  expect(calls[1].notificationIds).toEqual(["other-person-event"]);
  await view.close();
});

test("leaving and returning requires readiness again, including failed data loading", async () => {
  const view = await mount();
  pathname = "/portal/queries";
  await view.render();
  await act(async () => reportPortalDestinationReady("/portal/queries"));
  pathname = "/portal/tickets";
  await view.render();
  await act(async () => controls.startVisit("/portal/queries"));
  pathname = "/portal/queries";
  await view.render();
  expect(calls).toHaveLength(1);
  await act(async () => reportPortalDestinationReady("/portal/queries"));
  expect(calls).toHaveLength(2);
  await view.close();
});

test("a capped scan does not present an unknown zero as an empty workload", async () => {
  const partial = state([]);
  partial.byHref["/portal/queries"] = {
    complete: false,
    count: 0,
    eventIds: [],
    newActivity: false,
  };
  const view = await mount(partial);
  expect(view.node.textContent).toContain("Work count incomplete");
  expect(view.node.textContent).toContain("…");
  expect(view.node.textContent).not.toContain("0 work items need attention");
  await view.close();
});
