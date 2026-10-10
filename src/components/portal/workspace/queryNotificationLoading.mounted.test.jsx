import { afterAll, beforeAll, expect, mock, test } from "bun:test";
import { getFunctionName } from "convex/server";
import { JSDOM } from "jsdom";
import { act, useRef } from "react";
import { createRoot } from "react-dom/client";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citius.test/portal/queries",
});
let list = { results: [], status: "LoadingFirstPage" };
let detail;
const noLoad = () => undefined;

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  mock.module("convex/react", () => ({
    usePaginatedQuery: (reference, args) => ({
      ...(args !== "skip" && getFunctionName(reference) === "crm/queries:listPage"
        ? list
        : { results: [], status: "Exhausted" }),
      loadMore: noLoad,
    }),
    useQuery: (reference, args) => {
      if (args === "skip" || getFunctionName(reference) !== "crm/queries:getDetail") {
        return;
      }
      if (detail instanceof Error) {
        throw detail;
      }
      return detail;
    },
  }));
});

afterAll(() => {
  mock.restore();
  dom.window.close();
});

const retained = {
  clientName: "Acme",
  contractingStatus: "Order Lost",
  id: "lost-123",
  lostReason: "Competition",
  paxCount: 10,
  queryCode: "Q-123",
  salesStatus: "Order Lost",
};

async function mountNotification(open = "query", id = "lost-123", has = () => true) {
  const { usePortalWorkspaceData } = await import("./usePortalWorkspaceData");
  const { usePortalNotificationDeepLink } = await import("../usePortalNotificationDeepLink");
  const { createPortalWorkspaceModel } = await import("./portalWorkspaceModel");
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const opened = [];
  const errors = [];
  const onOpen = (modal, initial) => opened.push({ initial, modal });
  const toast = { error: (message) => errors.push(message) };
  let params = new URLSearchParams({ id, open });
  function Probe() {
    const handled = useRef("");
    const data = usePortalWorkspaceData({
      access: { roles: ["Sales"] },
      canFetch: true,
      dateRangeArg: undefined,
      deepLinkId: params.get("id"),
      deepLinkOpen: params.get("open"),
      deepLinkQueryId: params.get("queryId"),
      form: {},
      has,
      jobCardFilter: "",
      listFilters: {},
      modal: null,
      search: "",
      view: "queries",
    });
    const model = createPortalWorkspaceModel({
      ...data,
      access: { roles: ["Sales"] },
      allowed: true,
      canFetch: true,
      dateRange: {},
      deepLinkHandledRef: handled,
      gate: "ready",
      has: () => true,
      jobCardFilter: "",
      listFilterConfig: [],
      listFilters: {},
      openModal: onOpen,
      pathname: "/portal/queries",
      search: "",
      searchParams: params,
      toast,
      view: "queries",
    });
    usePortalNotificationDeepLink(model.chrome.deepLink);
    return <output>{handled.current}</output>;
  }
  const render = async () => {
    await act(async () => root.render(<Probe />));
  };
  window.history.replaceState({}, "", `/portal/queries?${params}`);
  try {
    await render();
  } catch (error) {
    await act(async () => root.unmount());
    container.remove();
    throw error;
  }
  return {
    errors,
    navigate: async (nextOpen, nextId) => {
      params = nextOpen
        ? new URLSearchParams({ id: nextId, open: nextOpen })
        : new URLSearchParams();
      window.history.replaceState({}, "", `/portal/queries?${params}`);
      await render();
    },
    opened,
    render,
    unmount: async () => {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

test("A query notification survives the active list arriving before its archived detail", async () => {
  list = { results: [], status: "LoadingFirstPage" };
  detail = undefined;
  const view = await mountNotification();
  list = { results: [], status: "Exhausted" };
  await view.render();
  expect(Object.fromEntries(new URLSearchParams(window.location.search))).toEqual({
    id: "lost-123",
    open: "query",
  });
  expect(view.errors).toEqual([]);
  detail = retained;
  await view.render();
  expect(view.opened).toEqual([
    {
      initial: expect.objectContaining({ clientName: "Acme", entityId: "lost-123" }),
      modal: "query",
    },
  ]);
  await view.render();
  expect(view.opened).toHaveLength(1);
  await view.unmount();
});

for (const open of ["query", "salesDecision", "assignQueryTeams"]) {
  for (const first of ["list", "detail"]) {
    test(`${open} waits for authorized detail when ${first} resolves first and opens once`, async () => {
      list = { results: [], status: "LoadingFirstPage" };
      detail = undefined;
      const view = await mountNotification(open);
      if (first === "list") {
        list = { results: [], status: "Exhausted" };
      } else {
        detail = retained;
      }
      await view.render();
      expect(Object.fromEntries(new URLSearchParams(window.location.search))).toEqual({
        id: "lost-123",
        open,
      });
      expect(view.errors).toEqual([]);
      const expectedId = open === "query" ? { entityId: "lost-123" } : { queryId: "lost-123" };
      expect(view.opened).toEqual(
        first === "detail" ? [{ initial: expect.objectContaining(expectedId), modal: open }] : []
      );
      list = { results: [], status: "Exhausted" };
      detail = retained;
      await view.render();
      await view.render();
      expect(view.opened).toEqual([{ initial: expect.objectContaining(expectedId), modal: open }]);
      expect(view.errors).toEqual([]);
      await view.unmount();
    });
  }

  test(`${open} rejects missing or newly unauthorized detail despite a cached matching row`, async () => {
    list = { results: [retained], status: "Exhausted" };
    detail = undefined;
    const view = await mountNotification(open);
    expect(Object.fromEntries(new URLSearchParams(window.location.search))).toEqual({
      id: "lost-123",
      open,
    });
    detail = null;
    await view.render();
    await view.render();
    expect(view.opened).toEqual([]);
    expect(view.errors).toEqual(["Record not found or you may not have access."]);
    expect(window.location.search).toBe("");
    await view.unmount();
  });
}

test("A late old Query detail cannot release a new notification target or reopen after navigation away", async () => {
  list = { results: [], status: "Exhausted" };
  detail = undefined;
  const view = await mountNotification("salesDecision", "lost-123");
  await view.navigate("salesDecision", "lost-456");
  detail = retained;
  await view.render();
  expect(view.opened).toEqual([]);
  expect(view.errors).toEqual([]);
  expect(Object.fromEntries(new URLSearchParams(window.location.search))).toEqual({
    id: "lost-456",
    open: "salesDecision",
  });
  detail = { ...retained, id: "lost-456", queryCode: "Q-456" };
  await view.render();
  expect(view.opened).toEqual([
    { initial: expect.objectContaining({ queryId: "lost-456" }), modal: "salesDecision" },
  ]);
  detail = undefined;
  await view.navigate("assignQueryTeams", "lost-789");
  await view.navigate(null, null);
  detail = { ...retained, id: "lost-789" };
  await view.render();
  expect(window.location.search).toBe("");
  expect(view.opened).toEqual([
    { initial: expect.objectContaining({ queryId: "lost-456" }), modal: "salesDecision" },
  ]);
  expect(view.errors).toEqual([]);
  await view.unmount();
});

test("An intentionally skipped unauthorized Query detail settles as unavailable", async () => {
  list = { results: [retained], status: "Exhausted" };
  detail = undefined;
  const view = await mountNotification("query", "lost-123", () => false);
  expect(view.opened).toEqual([]);
  expect(view.errors).toEqual(["Record not found or you may not have access."]);
  expect(window.location.search).toBe("");
  await view.unmount();
});

test("A global query permission failure propagates from the actual workspace data hook", async () => {
  list = { results: [retained], status: "Exhausted" };
  detail = new Error("FORBIDDEN");
  await expect(mountNotification("query", "lost-123")).rejects.toThrow("FORBIDDEN");
  expect(Object.fromEntries(new URLSearchParams(window.location.search))).toEqual({
    id: "lost-123",
    open: "query",
  });
});
