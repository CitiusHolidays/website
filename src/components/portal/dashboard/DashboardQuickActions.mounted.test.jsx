import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { PORTAL_PERMISSIONS as P } from "@/lib/portal/constants";

let DashboardQuickActions;

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/portal",
});

beforeAll(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Element = dom.window.Element;
  globalThis.Node = dom.window.Node;
  globalThis.MouseEvent = dom.window.MouseEvent;
  globalThis.PointerEvent = dom.window.PointerEvent;
  globalThis.KeyboardEvent = dom.window.KeyboardEvent;
  globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
  ({ DashboardQuickActions } = await import("./DashboardQuickActions"));
});

afterAll(() => dom.window.close());

describe("DashboardQuickActions", () => {
  test("preserves primary and overflow action behavior", async () => {
    const openModal = mock(() => undefined);
    const permissions = new Set([P.MANAGE_QUERIES, P.MANAGE_PROPOSALS]);
    const has = (permission) => permissions.has(permission);
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => root.render(<DashboardQuickActions has={has} openModal={openModal} />));

    const createQuery = [...container.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "Create query"
    );
    expect(createQuery?.className).toContain("portal-primary-btn");
    await act(async () => createQuery?.click());
    expect(openModal).toHaveBeenLastCalledWith("query");

    const overflow = [...container.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "Create"
    );
    await act(async () => overflow?.click());
    expect(overflow?.getAttribute("aria-expanded")).toBe("true");

    const createProposal = [...document.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "Create proposal"
    );
    await act(async () => createProposal?.click());
    expect(openModal).toHaveBeenLastCalledWith("proposal");
    expect(overflow?.getAttribute("aria-expanded")).toBe("false");

    await act(async () => root.unmount());
    container.remove();
  });
});
