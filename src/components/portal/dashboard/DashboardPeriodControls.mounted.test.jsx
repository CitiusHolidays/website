// biome-ignore-all lint/performance/noJsxPropsBind: mounted test callbacks are intentionally local.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act, useState } from "react";
import { createRoot } from "react-dom/client";

let DashboardPeriodControls;

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  pretendToBeVisual: true,
  url: "https://citiusholidays.com/portal",
});

beforeAll(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Element = dom.window.Element;
  globalThis.Node = dom.window.Node;
  globalThis.Event = dom.window.Event;
  globalThis.KeyboardEvent = dom.window.KeyboardEvent;
  globalThis.MouseEvent = dom.window.MouseEvent;
  globalThis.PointerEvent = dom.window.PointerEvent;
  globalThis.MutationObserver = dom.window.MutationObserver;
  globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  globalThis.cancelAnimationFrame = (frame) => clearTimeout(frame);
  const noop = () => undefined;
  const matchMedia = (query) => ({
    addEventListener: noop,
    addListener: noop,
    dispatchEvent: () => false,
    matches: false,
    media: query,
    onchange: null,
    removeEventListener: noop,
    removeListener: noop,
  });
  dom.window.matchMedia = matchMedia;
  globalThis.matchMedia = matchMedia;
  ({ DashboardPeriodControls } = await import("./DashboardPeriodControls"));
});

afterAll(() => dom.window.close());

function Harness({ initialRange }) {
  const [dateRange, setDateRange] = useState(initialRange);
  return <DashboardPeriodControls dateRange={dateRange} setDateRange={setDateRange} />;
}

async function mountPeriodControls(initialRange) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<Harness initialRange={initialRange} />));
  return { container, root };
}

describe("Mounted dashboard period disclosure", () => {
  test("Summarizes a custom range and restores trigger focus after Escape", async () => {
    const { container, root } = await mountPeriodControls({
      from: "2026-08-02",
      to: "2026-08-11",
    });
    const trigger = container.querySelector('button[aria-label="Period: 02/08/2026 – 11/08/2026"]');
    expect(trigger).not.toBeNull();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(container.querySelector("[data-dashboard-period-desktop]")).not.toBeNull();

    await act(async () => trigger.click());
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    const popup = document.querySelector('[aria-label="dashboard period filters"]');
    expect(popup).not.toBeNull();
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(popup.textContent).toContain("From");
    expect(popup.textContent).toContain("To");

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(document.querySelector('[aria-label="dashboard period filters"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);

    await act(async () => root.unmount());
    container.remove();
  });

  test("Keeps invalid custom ranges visible and unapplied", async () => {
    const { container, root } = await mountPeriodControls({
      from: "2026-08-12",
      to: "2026-08-01",
    });
    const trigger = container.querySelector(
      'button[aria-label="Period: 12/08/2026 – 01/08/2026, check dates"]'
    );
    expect(trigger).not.toBeNull();
    await act(async () => trigger.click());
    expect(
      document.querySelector('[aria-label="dashboard period filters"] [role="alert"]')
    ).not.toBeNull();

    await act(async () => root.unmount());
    container.remove();
  });

  test("Updates the compact summary when a preset is selected", async () => {
    const { container, root } = await mountPeriodControls({ from: null, to: null });
    const trigger = container.querySelector('button[aria-label="Period: All time"]');
    await act(async () => trigger.click());
    const popup = document.querySelector('[aria-label="dashboard period filters"]');
    const thirtyDays = [...popup.querySelectorAll("button")].find(
      (button) => button.textContent.trim() === "30d"
    );
    expect(thirtyDays.getAttribute("aria-pressed")).toBe("false");
    await act(async () => thirtyDays.click());
    expect(container.querySelector('button[aria-label="Period: 30d"]')).not.toBeNull();
    expect(thirtyDays.getAttribute("aria-pressed")).toBe("true");

    await act(async () => root.unmount());
    container.remove();
  });
});
