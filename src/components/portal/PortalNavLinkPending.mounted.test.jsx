import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { PortalNavLinkPendingIndicator } from "./PortalNavLinkPending";

const dom = new JSDOM("<!doctype html><html><body></body></html>");

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
});

afterAll(() => dom.window.close());

describe("PortalNavLinkPending", () => {
  test("announces a pending destination without replacing the link label", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    await act(async () =>
      root.render(<PortalNavLinkPendingIndicator label="All Sales Queries" pending />)
    );

    expect(container.querySelector('[data-testid="portal-nav-link-pending"]')).not.toBeNull();
    expect(container.textContent).toContain("Loading All Sales Queries");
    const indicator = container.querySelector('[aria-hidden="true"]');
    expect(indicator).not.toBeNull();
    expect(indicator?.className).toContain("bg-brand-muted/45");
    expect(indicator?.className).not.toContain("bg-citius-blue");
    expect(indicator?.className).not.toContain("bg-citius-orange");

    await act(async () => root.unmount());
  });

  test("renders nothing after the navigation settles", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    await act(async () =>
      root.render(<PortalNavLinkPendingIndicator label="All Sales Queries" pending={false} />)
    );

    expect(container.querySelector('[data-testid="portal-nav-link-pending"]')).toBeNull();
    expect(container.textContent).toBe("");

    await act(async () => root.unmount());
  });
});
