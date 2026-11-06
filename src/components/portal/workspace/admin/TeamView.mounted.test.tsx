import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import type { PortalTeamDirectoryRow } from "../portalViewTypes";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/portal/team",
});
let TeamView: typeof import("./TeamView").TeamView;
let createRoot: typeof import("react-dom/client").createRoot;

beforeAll(async () => {
  Object.assign(globalThis, {
    cancelAnimationFrame: (id: ReturnType<typeof setTimeout>) => clearTimeout(id),
    document: dom.window.document,
    Event: dom.window.Event,
    HTMLElement: dom.window.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true,
    MouseEvent: dom.window.MouseEvent,
    Node: dom.window.Node,
    PointerEvent: dom.window.MouseEvent,
    ResizeObserver: class {
      observe() {
        // JSDOM has no layout; nothing to observe.
      }
      disconnect() {
        // No observer resources exist in this test double.
      }
    },
    requestAnimationFrame: (callback: () => void) => setTimeout(callback, 0),
    window: dom.window,
  });
  ({ createRoot } = await import("react-dom/client"));
  ({ TeamView } = await import("./TeamView"));
});
afterAll(() => dom.window.close());

const rows: PortalTeamDirectoryRow[] = [
  {
    department: "Sales",
    email: "bhavesh@citius.example",
    function: "Sales leadership",
    id: "staff-1",
    location: "Mumbai",
    mobile: "+91 98200 00137",
    name: "Bhavesh Mehta",
    roles: ["Sales Head"],
  },
  {
    department: "Operations",
    email: "esha@citius.example",
    // The server falls back to the roles list when no function is recorded.
    function: "Operations",
    id: "staff-2",
    isCurrentUser: true,
    location: "Kolkata",
    mobile: "",
    name: "Esha Banerjee",
    roles: ["Operations"],
  },
];

async function mount() {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<TeamView rows={rows} />));
  return {
    container,
    headers: () =>
      [...container.querySelectorAll("thead th")].map((cell) => cell.textContent?.trim()),
    unmount: async () => {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

describe("Team Directory", () => {
  test("shows name with role, department, location, email and mobile, with Function optional", async () => {
    const view = await mount();
    try {
      expect(view.headers()).toEqual([
        "Name and role",
        "Department",
        "Location",
        "Email",
        "Mobile",
        "Function",
      ]);
      expect(view.container.textContent).not.toContain("Access");
      const desktop = view.container.querySelector("table");
      expect(desktop?.textContent).toContain("Sales Head");
      // A function that only repeats the role is not printed a second time.
      const eshaRow = [...(desktop?.querySelectorAll("tbody tr") ?? [])].find((row) =>
        row.textContent?.includes("Esha Banerjee")
      );
      expect(eshaRow?.lastElementChild?.textContent).toBe("-");

      const toggle = view.container.querySelector<HTMLElement>('[aria-label="Function column"]');
      expect(toggle).not.toBeNull();
      await act(async () => toggle?.click());
      expect(view.headers()).not.toContain("Function");
    } finally {
      await view.unmount();
    }
  });

  test("links email and mobile with accessible names in the table and the phone cards", async () => {
    const view = await mount();
    try {
      const mail = [...view.container.querySelectorAll('a[href="mailto:bhavesh@citius.example"]')];
      const call = [...view.container.querySelectorAll('a[href="tel:+919820000137"]')];
      expect(mail.length).toBe(2);
      expect(call.length).toBe(2);
      for (const link of mail) {
        expect(link.getAttribute("aria-label")).toBe(
          "Email Bhavesh Mehta at bhavesh@citius.example"
        );
      }
      for (const link of call) {
        expect(link.getAttribute("aria-label")).toBe("Call Bhavesh Mehta on +91 98200 00137");
        expect(link.className).toContain("whitespace-nowrap");
      }
      // No number, no dead tel: link.
      expect(view.container.querySelector('a[aria-label^="Call Esha"]')).toBeNull();
      const cards = view.container.querySelector(".md\\:hidden");
      expect(cards?.textContent).toContain("Sales Head · Sales · Mumbai");
      expect(cards?.textContent).not.toContain("Sales leadership");
      expect(cards?.textContent).toContain("(you)");
    } finally {
      await view.unmount();
    }
  });
});
