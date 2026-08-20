import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { PortalLoadingAnnouncement } from "./PortalLoadingAnnouncement";
import { beginPortalLoading, endPortalLoading } from "./portalLoadingStore";
import { LoadingPanel, PortalViewLoading } from "./workspace/portalAdminHelpers";

const dom = new JSDOM("<!doctype html><html><body></body></html>");

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
});

afterAll(() => dom.window.close());

describe("Staff Workspace loading announcement", () => {
  test("Nested route and lazy waits share one persistent polite owner without overwrites", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    await act(() =>
      root.render(
        <>
          <PortalLoadingAnnouncement />
          <LoadingPanel />
          <PortalViewLoading />
        </>
      )
    );

    const announcer = container.querySelector("[data-portal-loading-announcer]");
    expect(container.querySelectorAll("[data-portal-loading-announcer]")).toHaveLength(1);
    expect(announcer?.getAttribute("aria-live")).toBe("polite");
    expect(announcer?.textContent).toBe("Loading Staff Workspace view");
    expect(container.querySelectorAll('[aria-busy="true"]')).toHaveLength(2);
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(3);

    let destinationWait;
    await act(() => {
      destinationWait = beginPortalLoading("Loading All Sales Queries");
    });
    expect(announcer?.textContent).toBe("Loading Staff Workspace view");
    await act(() => endPortalLoading(destinationWait));
    await act(() => root.unmount());
    container.remove();
  });

  test("The first semantic wait owns the announcement until every nested wait settles", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    await act(() => root.render(<PortalLoadingAnnouncement />));
    const announcer = container.querySelector("[data-portal-loading-announcer]");

    let destinationWait;
    let fallbackWait;
    await act(() => {
      destinationWait = beginPortalLoading("Loading All Sales Queries");
      fallbackWait = beginPortalLoading();
    });
    expect(announcer?.textContent).toBe("Loading All Sales Queries");

    await act(() => endPortalLoading(destinationWait));
    expect(announcer?.textContent).toBe("Loading All Sales Queries");
    await act(() => endPortalLoading(fallbackWait));
    expect(announcer?.textContent).toBe("");

    await act(() => root.unmount());
    container.remove();
  });
});
