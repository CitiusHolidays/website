// biome-ignore-all lint/performance/noJsxPropsBind: mounted test mocks and callbacks are intentionally local.
import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";

const pushed = [];
const readCalls = [];

mock.module("@convex/_generated/api", () => ({
  api: {
    crm: {
      activity: {
        listNotifications: "listNotifications",
        markNotificationRead: "markNotificationRead",
        notificationSummary: "notificationSummary",
      },
      navShortcuts: { list: "navShortcuts" },
    },
  },
}));

mock.module("convex/react", () => ({
  useConvexAuth: () => ({ isAuthenticated: true }),
  useMutation: () => (args) => {
    readCalls.push(args);
    return Promise.resolve();
  },
  useQuery: (query) => {
    if (query === "listNotifications") {
      return [
        {
          body: "Review the linked proposal",
          entityId: "proposal-1",
          entityType: "proposal",
          id: "notification-1",
          readAt: null,
          title: "Proposal ready",
        },
      ];
    }
    if (query === "notificationSummary") {
      return { unreadCount: 1 };
    }
    return { recentJobCards: [], recentProposals: [], recentQueries: [], recentTickets: [] };
  },
}));

mock.module("next/navigation", () => ({
  usePathname: () => "/portal",
  useRouter: () => ({ push: (href) => pushed.push(href) }),
}));

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/portal",
});

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Element = dom.window.Element;
  globalThis.Node = dom.window.Node;
  globalThis.Event = dom.window.Event;
  globalThis.MouseEvent = dom.window.MouseEvent;
  globalThis.KeyboardEvent = dom.window.KeyboardEvent;
  globalThis.PointerEvent = dom.window.PointerEvent;
  globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  globalThis.localStorage = dom.window.localStorage;
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
  const noop = () => undefined;
  const matchMedia = (query) => ({
    addEventListener: noop,
    addListener: noop,
    dispatchEvent: () => false,
    matches: false,
    media: String(query),
    onchange: null,
    removeEventListener: noop,
    removeListener: noop,
  });
  dom.window.matchMedia = matchMedia;
  globalThis.matchMedia = matchMedia;
});

afterAll(() => {
  mock.restore();
  dom.window.close();
});

beforeEach(() => {
  pushed.length = 0;
  readCalls.length = 0;
});

describe("PortalShell menu and notification contracts", () => {
  test("opening and closing performs zero reads; item activation reads once and deep-links once", async () => {
    const { default: PortalShell } = await import("./PortalShell");
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () =>
      root.render(
        <PortalShell access={{ allowed: true, permissions: [], roles: ["Sales"] }}>
          <p>Workspace</p>
        </PortalShell>
      )
    );

    const trigger = container.querySelector('button[aria-label="Open notifications"]');
    await act(async () => trigger.click());
    expect(readCalls).toEqual([]);
    expect(document.body.textContent).toContain("Proposal ready");

    await act(async () =>
      document.querySelector('button[aria-label="Close notifications"]').click()
    );
    expect(readCalls).toEqual([]);

    await act(async () => trigger.click());
    const notification = [...document.querySelectorAll("button")].find((button) =>
      button.textContent.includes("Proposal ready")
    );
    await act(async () => notification.click());
    expect(readCalls).toEqual([{ notificationId: "notification-1" }]);
    expect(pushed).toHaveLength(1);
    expect(pushed[0]).toContain("/portal/proposals");
    expect(pushed[0]).toContain("open=proposal");
    expect(pushed[0]).toContain("id=proposal-1");

    await act(async () => root.unmount());
    container.remove();
  });

  test("notifications close on Escape and restore bell focus without marking anything read", async () => {
    const { default: PortalShell } = await import("./PortalShell");
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () =>
      root.render(
        <PortalShell access={{ allowed: true, permissions: [], roles: ["Sales"] }}>
          <p>Workspace</p>
        </PortalShell>
      )
    );

    const trigger = container.querySelector('button[aria-label="Open notifications"]');
    await act(async () => trigger.click());
    const popup = document.querySelector('[aria-label="notifications"]');
    expect(popup).not.toBeNull();
    expect(popup.className).toContain("portal-shell-surface");
    expect(popup.className).toContain("w-[min(20rem,calc(100vw-2rem))]");

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(document.querySelector('[aria-label="notifications"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(readCalls).toEqual([]);

    await act(async () => root.unmount());
    container.remove();
  });

  test("mobile navigation locks the document and restores its trigger after Escape", async () => {
    const { default: PortalShell } = await import("./PortalShell");
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () =>
      root.render(
        <PortalShell access={{ allowed: true, permissions: [], roles: ["Sales"] }}>
          <p>Workspace</p>
        </PortalShell>
      )
    );

    const trigger = container.querySelector('button[aria-label="Open portal navigation"]');
    await act(async () => trigger.click());
    const drawer = document.querySelector("aside.portal-mobile-drawer");
    const backdrop = document.querySelector(
      'button[aria-label="Close portal navigation backdrop"]'
    );
    expect(drawer).not.toBeNull();
    expect(drawer.tagName).toBe("ASIDE");
    expect(drawer.className).toContain("fixed inset-y-0 left-0");
    expect(drawer.className).toContain("w-[min(20rem,calc(100vw-1.5rem))]");
    expect(backdrop?.className).toContain("fixed inset-0");
    expect(backdrop?.className).toContain("bg-slate-950/70");
    expect(document.documentElement.hasAttribute("data-base-ui-scroll-locked")).toBe(true);

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(document.querySelector("aside.portal-mobile-drawer")).toBeNull();
    expect(document.documentElement.hasAttribute("data-base-ui-scroll-locked")).toBe(false);
    expect(document.activeElement).toBe(trigger);

    await act(async () => trigger.click());
    await act(async () =>
      document.querySelector('button[aria-label="Close portal navigation"]')?.click()
    );
    expect(document.querySelector("aside.portal-mobile-drawer")).toBeNull();
    expect(document.activeElement).toBe(trigger);

    await act(async () => trigger.click());
    const navigationLink = document.querySelector('aside.portal-mobile-drawer a[href^="/portal"]');
    expect(navigationLink).not.toBeNull();
    navigationLink?.addEventListener("click", (event) => event.preventDefault(), { once: true });
    await act(async () =>
      navigationLink?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }))
    );
    expect(document.querySelector("aside.portal-mobile-drawer")).toBeNull();

    await act(async () => root.unmount());
    container.remove();
  });

  test("account menu preserves copy and restores trigger focus after Escape", async () => {
    const { default: PortalShell } = await import("./PortalShell");
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () =>
      root.render(
        <PortalShell
          access={{
            allowed: true,
            email: "nina@example.com",
            name: "Nina Shah",
            permissions: [],
            roles: ["Sales"],
          }}
        >
          <p>Workspace</p>
        </PortalShell>
      )
    );

    const trigger = container.querySelector('button[aria-label="Open account menu for Nina Shah"]');
    await act(async () => {
      trigger.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const menu = document.querySelector('[role="menu"][aria-label="Account"]');
    expect(menu).not.toBeNull();
    expect(
      [...menu.querySelectorAll('[role="menuitem"]')].map((item) => item.textContent.trim())
    ).toEqual(["Back to site", "Sign out"]);

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger);

    await act(async () => root.unmount());
    container.remove();
  });
});
