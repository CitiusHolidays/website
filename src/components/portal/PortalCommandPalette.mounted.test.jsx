// biome-ignore-all lint/performance/noJsxPropsBind: mounted test callbacks stay close to their harness.
// biome-ignore-all lint/suspicious/useAwait: React act callbacks intentionally flush synchronously.

import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";

let createRoot;
let PortalCommandPaletteRoot;
let PortalCommandPaletteTrigger;
const paletteQueryCalls = [];
let paletteQueryResults = {};

mock.module("@convex/_generated/api", () => ({
  api: {
    crm: {
      jobCards: { listPage: "jobCards.listPage" },
      listSearch: { getReadiness: "listSearch.getReadiness" },
      queries: { listPage: "queries.listPage" },
    },
  },
}));

mock.module("convex/react", () => ({
  useQuery: (reference, args) => {
    if (args === "skip") {
      return;
    }
    paletteQueryCalls.push({ args, reference });
    return paletteQueryResults[reference];
  },
}));

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  pretendToBeVisual: true,
  url: "https://citiusholidays.com/portal",
});
const DESKTOP_QUERY_PATTERN = /min-width:\s*1024px/;

beforeAll(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.HTMLInputElement = dom.window.HTMLInputElement;
  globalThis.Element = dom.window.Element;
  globalThis.Node = dom.window.Node;
  globalThis.KeyboardEvent = dom.window.KeyboardEvent;
  globalThis.Event = dom.window.Event;
  globalThis.InputEvent = dom.window.InputEvent;
  globalThis.MouseEvent = dom.window.MouseEvent;
  globalThis.PointerEvent = dom.window.PointerEvent ?? dom.window.MouseEvent;
  globalThis.MutationObserver = dom.window.MutationObserver;
  globalThis.ResizeObserver = class ResizeObserver {
    disconnect() {
      // Intentional JSDOM observer stub.
    }
    observe() {
      // Intentional JSDOM observer stub.
    }
    unobserve() {
      // Intentional JSDOM observer stub.
    }
  };
  globalThis.getComputedStyle = dom.window.getComputedStyle;
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
  dom.window.requestAnimationFrame = globalThis.requestAnimationFrame;
  dom.window.cancelAnimationFrame = globalThis.cancelAnimationFrame;
  dom.window.HTMLElement.prototype.attachEvent = () => undefined;
  dom.window.HTMLElement.prototype.detachEvent = () => undefined;
  dom.window.HTMLElement.prototype.scrollIntoView = () => undefined;
  const matchMedia = (query) => ({
    addEventListener: () => undefined,
    addListener: () => undefined,
    dispatchEvent: () => false,
    matches: DESKTOP_QUERY_PATTERN.test(String(query)),
    media: String(query),
    onchange: null,
    removeEventListener: () => undefined,
    removeListener: () => undefined,
  });
  dom.window.matchMedia = matchMedia;
  globalThis.matchMedia = matchMedia;
  ({ createRoot } = await import("react-dom/client"));
  ({ PortalCommandPaletteRoot, PortalCommandPaletteTrigger } = await import(
    "./PortalCommandPalette.js"
  ));
});

beforeEach(() => {
  paletteQueryCalls.length = 0;
  paletteQueryResults = {};
});

afterAll(() => {
  mock.restore();
  dom.window.close();
});

function buildWorkspace(overrides = {}) {
  return {
    applyLayoutPreset: mock(() => undefined),
    applySavedView: mock(() => undefined),
    clearAllFilters: mock(() => undefined),
    has: (permission) => permission === "manage:queries",
    layoutPresets: [
      {
        filterState: {
          columns: ["invoice"],
          kind: "portal-table-layout-v1",
          scope: "finance:invoices",
          sort: null,
        },
        id: "layout-1",
        name: "Finance review",
        sharedRole: "Finance",
        view: "finance",
      },
    ],
    meta: { title: "Dashboard" },
    navGroups: [
      {
        items: [{ href: "/portal/queries", iconName: "Navigation", label: "Queries" }],
        label: "Sales",
      },
    ],
    navShortcuts: {
      queries: [{ href: "/portal/queries?open=query&id=q1", id: "q1", label: "Q-1" }],
    },
    openModal: mock(() => undefined),
    pathname: "/portal",
    savedViews: [{ id: "sv1", name: "My jobs", pathname: "/portal/job-cards", view: "job-cards" }],
    ...overrides,
  };
}

function Harness({ onSaveView = mock(() => undefined), workspace = buildWorkspace() }) {
  return (
    <PortalCommandPaletteRoot onSaveView={onSaveView} workspace={workspace}>
      <PortalCommandPaletteTrigger />
    </PortalCommandPaletteRoot>
  );
}

async function settle() {
  await act(async () => new Promise((resolve) => setTimeout(resolve, 30)));
}

async function enterSearch(input, value) {
  await act(async () => {
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    valueSetter?.call(input, value);
    input.dispatchEvent(
      new InputEvent("input", { bubbles: true, data: value, inputType: "insertText" })
    );
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await settle();
}

describe("PortalCommandPalette", () => {
  test("Preserves the established main-content frame, geometry, groups, and cmdk structure", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => root.render(<Harness />));
    const trigger = container.querySelector("button");
    trigger.focus();
    await act(async () => trigger.click());
    await settle();

    const viewport = document.querySelector(".portal-command-overlay");
    const backdrop = viewport.querySelector(".portal-command-backdrop");
    const panel = viewport.querySelector(".portal-command-panel");
    const dialog = document.querySelector('[role="dialog"]');
    const input = dialog.querySelector("[cmdk-input]");

    expect(dialog.hasAttribute("cmdk-root")).toBe(true);
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.className).toContain("max-w-xl");
    expect(dialog.className).toContain("portal-command-surface");
    expect(dialog.querySelector("[cmdk-list]")).toBeTruthy();
    expect(document.activeElement).toBe(input);
    expect(container.getAttribute("aria-hidden")).toBe("true");
    expect(document.body.style.overflowY).toBe("hidden");
    expect(document.documentElement.hasAttribute("data-base-ui-scroll-locked")).toBe(true);
    expect(viewport.style.position).toBe("fixed");
    expect(viewport.style.left).toBe("256px");
    expect(viewport.style.top).toBe("68px");
    expect(viewport.style.bottom).toBe("0px");
    expect(viewport.style.width).toBe("calc(100vw - 256px)");
    expect(viewport.style.zIndex).toBe("55");
    expect(backdrop.style.position).toBe("absolute");
    expect(backdrop.style.inset).toBe("0px");
    expect(backdrop.style.pointerEvents).toBe("auto");
    expect(panel.style.position).toBe("fixed");
    expect(panel.style.left).toBe("256px");
    expect(panel.style.paddingInline).toBe("0.75rem");
    expect(panel.style.top).toBe("calc(9.25rem)");
    expect(panel.style.width).toBe("calc(100vw - 256px)");
    expect(panel.style.zIndex).toBe("55");
    expect(
      [...dialog.querySelectorAll("[cmdk-group-heading]")].map((heading) => heading.textContent)
    ).toEqual([
      "Navigate",
      "Create",
      "Recent authorized records",
      "Saved views",
      "Layouts",
      "Actions",
    ]);
    expect(input.placeholder).toBe("Search pages, actions, and authorized records…");

    await act(async () => root.unmount());
    container.remove();
  });

  test("Delegates Arrow navigation and Enter selection to cmdk", async () => {
    const workspace = buildWorkspace();
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => root.render(<Harness workspace={workspace} />));
    const trigger = container.querySelector("button");
    trigger.focus();
    await act(async () => trigger.click());
    await settle();

    const input = document.querySelector("[cmdk-input]");
    expect(document.querySelector('[cmdk-item][data-selected="true"]').textContent).toContain(
      "Queries"
    );
    await act(async () =>
      input.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowDown" }))
    );
    await settle();
    expect(document.querySelector('[cmdk-item][data-selected="true"]').textContent).toContain(
      "New query"
    );
    await act(async () =>
      input.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }))
    );
    await settle();

    expect(workspace.openModal).toHaveBeenCalledWith("query");
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);

    await act(async () => root.unmount());
    container.remove();
  });

  test("Keeps filtering external, lets cmdk run the selected command, and restores focus", async () => {
    const workspace = buildWorkspace();
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => root.render(<Harness workspace={workspace} />));
    const trigger = container.querySelector("button");
    trigger.focus();
    await act(async () => trigger.click());
    await settle();

    const input = document.querySelector("[cmdk-input]");
    await enterSearch(input, "New query");
    expect([...document.querySelectorAll("[cmdk-item]")].map((item) => item.textContent)).toEqual([
      expect.stringContaining("New query"),
    ]);

    await act(async () =>
      input.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }))
    );
    await settle();
    expect(workspace.openModal).toHaveBeenCalledWith("query");
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);

    await act(async () => root.unmount());
    container.remove();
  });

  test("Debounces bounded authorized record search and gates each source by route permission", async () => {
    paletteQueryResults = {
      "jobCards.listPage": {
        page: [
          {
            clientName: "Older authorized traveller",
            destination: "Kyoto",
            id: "jobCards_older",
            jobCode: "JC-0042",
          },
        ],
      },
      "listSearch.getReadiness": {
        tables: { jobCards: true, queries: true },
      },
      "queries.listPage": {
        page: [
          {
            clientName: "Older authorized client",
            destination: "Kōyasan",
            id: "queries_older",
            queryCode: "Q-0042",
          },
        ],
      },
    };
    const workspace = buildWorkspace({
      has: (permission) => permission === "view:queries",
    });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => root.render(<Harness workspace={workspace} />));
    const trigger = container.querySelector("button");
    trigger.focus();
    await act(async () => trigger.click());
    await settle();
    const input = document.querySelector("[cmdk-input]");

    await enterSearch(input, "a");
    expect(paletteQueryCalls).toEqual([]);

    await enterSearch(input, "  older   client  ");
    expect(document.querySelector('[role="status"]').textContent).toBe(
      "Searching authorized records…"
    );
    await act(async () => new Promise((resolve) => setTimeout(resolve, 230)));

    expect(paletteQueryCalls).toContainEqual({ args: {}, reference: "listSearch.getReadiness" });
    expect(paletteQueryCalls).toContainEqual({
      args: {
        paginationOpts: { cursor: null, numItems: 12 },
        search: "older client",
      },
      reference: "queries.listPage",
    });
    expect(paletteQueryCalls.some((call) => call.reference === "jobCards.listPage")).toBe(false);
    expect(document.body.textContent).toContain("Q-0042");
    expect(document.body.textContent).not.toContain("JC-0042");
    expect(document.body.textContent).not.toContain("Recent authorized records");
    expect(document.querySelector('[role="status"]')).toBeNull();

    await act(async () => root.unmount());
    container.remove();
  });

  test("Applies a layout command without navigating or invoking filter views", async () => {
    const workspace = buildWorkspace();
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => root.render(<Harness workspace={workspace} />));
    const trigger = container.querySelector("button");
    trigger.focus();
    await act(async () => trigger.click());
    await settle();

    const input = document.querySelector("[cmdk-input]");
    await enterSearch(input, "Finance review");
    expect(document.querySelector('[cmdk-item][data-selected="true"]').textContent).toContain(
      "Finance review"
    );
    await act(async () =>
      input.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }))
    );
    await settle();

    expect(workspace.applyLayoutPreset).toHaveBeenCalledWith(workspace.layoutPresets[0]);
    expect(workspace.applySavedView).not.toHaveBeenCalled();

    await act(async () => root.unmount());
    container.remove();
  });

  test("Shows the stable empty state and delegates Escape dismissal to Base UI", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => root.render(<Harness />));
    const trigger = container.querySelector("button");
    trigger.focus();
    await act(async () => trigger.click());
    await settle();

    const input = document.querySelector("[cmdk-input]");
    await enterSearch(input, "nothing-matches-this");
    expect(document.querySelector("[cmdk-empty]").textContent).toBe("No matching commands");

    await act(async () =>
      input.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }))
    );
    await settle();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);

    await act(async () => root.unmount());
    container.remove();
  });

  test("Toggles instantly with the platform shortcut and restores the prior focus origin", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => root.render(<Harness />));
    const trigger = container.querySelector("button");
    trigger.focus();
    await act(async () =>
      window.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "k", metaKey: true }))
    );
    await settle();
    expect(document.querySelector('[role="dialog"]')).toBeTruthy();
    expect(document.activeElement).toBe(document.querySelector("[cmdk-input]"));

    await act(async () =>
      window.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "k", metaKey: true }))
    );
    await settle();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);

    await act(async () =>
      window.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, ctrlKey: true, key: "k" }))
    );
    await settle();
    expect(document.querySelector('[role="dialog"]')).toBeTruthy();
    await act(async () =>
      window.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, ctrlKey: true, key: "k" }))
    );
    await settle();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);

    await act(async () => root.unmount());
    container.remove();
  });
});
