// biome-ignore-all lint/performance/noJsxPropsBind: mounted test callbacks are local fixtures.
import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { DashboardActionInbox } from "./DashboardActionInbox";
import { DashboardActivityStrip } from "./DashboardActivityStrip";
import { DashboardPanel } from "./DashboardPanel";
import { DashboardPipelineSnapshot } from "./DashboardPipelineSnapshot";
import { DashboardWorkQueuesSummary } from "./DashboardWorkQueue";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  pretendToBeVisual: true,
  url: "https://citiusholidays.com/portal",
});

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.Element = dom.window.Element;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  globalThis.Event = dom.window.Event;
  globalThis.MutationObserver = dom.window.MutationObserver;
  globalThis.getComputedStyle = dom.window.getComputedStyle;
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  globalThis.cancelAnimationFrame = (frame) => clearTimeout(frame);
  dom.window.requestAnimationFrame = globalThis.requestAnimationFrame;
  dom.window.cancelAnimationFrame = globalThis.cancelAnimationFrame;
  dom.window.matchMedia = () => ({
    addEventListener() {
      // The dashboard fixture keeps one stable motion preference.
    },
    matches: false,
    removeEventListener() {
      // Motion cleanup mirrors the inert fixture subscription above.
    },
  });
  globalThis.matchMedia = dom.window.matchMedia;
  globalThis.ResizeObserver = class {
    disconnect() {
      // The fixture does not emit resize records.
    }
    observe() {
      // The fixture does not emit resize records.
    }
    unobserve() {
      // The fixture does not emit resize records.
    }
  };
});

afterEach(() => document.body.replaceChildren());
afterAll(() => dom.window.close());

async function mount(element) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(element));
  return { container, root };
}

describe("Dashboard panel hierarchy", () => {
  test("Names visible and intentionally headerless panels without an empty header row", async () => {
    const view = await mount(
      <DashboardPanel ariaLabel="Reviewed headerless panel">
        <p>Panel content</p>
      </DashboardPanel>
    );
    const panel = view.container.querySelector("section");
    expect(panel.getAttribute("aria-label")).toBe("Reviewed headerless panel");
    expect(panel.querySelector("h2")).toBeNull();
    expect(panel.children).toHaveLength(1);
    expect(panel.firstElementChild.textContent).toBe("Panel content");
    await act(async () => view.root.unmount());
  });

  test("Keeps populated and empty Pipeline plus Activity under visible names", async () => {
    const view = await mount(
      <>
        <DashboardPipelineSnapshot dateRange={{ preset: "30d" }} pipelineSnapshot={[]} />
        <DashboardPipelineSnapshot
          dateRange={{ preset: "30d" }}
          pipelineSnapshot={[{ count: 2, stage: "New", value: 20_000, weighted: 10_000 }]}
        />
        <DashboardActivityStrip
          activities={[{ action: "created", createdAt: 1, id: "activity-1", message: "Created" }]}
          canView
        />
      </>
    );
    const headings = [...view.container.querySelectorAll("h2")].map((node) => node.textContent);
    expect(headings).toEqual(["Pipeline snapshot", "Pipeline snapshot", "Recent activity"]);
    expect(view.container.textContent).toContain("Open pipeline");
    expect(view.container.textContent).toContain("View all activity");
    expect(view.container.querySelectorAll("span.size-2")).toHaveLength(0);
    await act(async () => view.root.unmount());
  });

  test("Flattens consecutive true empty states inside their existing panels", async () => {
    const view = await mount(
      <>
        <DashboardActionInbox actions={[]} dateRange={{ preset: "30d" }} />
        <DashboardWorkQueuesSummary rows={[]} />
      </>
    );
    const emptyStates = [...view.container.querySelectorAll("section > p")];
    expect(emptyStates).toHaveLength(2);
    for (const emptyState of emptyStates) {
      expect(emptyState.className).toContain("border-t");
      expect(emptyState.className).toContain("py-3");
      expect(emptyState.className).not.toContain("border-dashed");
      expect(emptyState.className).not.toContain("rounded");
      expect(emptyState.className).not.toContain("bg-brand-light");
      expect(emptyState.className).not.toContain("py-8");
    }
    expect(view.container.querySelectorAll("section")).toHaveLength(2);
    await act(async () => view.root.unmount());
  });
});
