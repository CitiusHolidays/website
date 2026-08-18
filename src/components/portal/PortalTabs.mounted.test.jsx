import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act, useState } from "react";
import { createRoot } from "react-dom/client";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/portal/hotels?tab=rooming",
});

let PipelineModeSelector;
let PortalTabs;

beforeAll(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  globalThis.KeyboardEvent = dom.window.KeyboardEvent;
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  globalThis.cancelAnimationFrame = (frame) => clearTimeout(frame);
  ({ PortalTabs } = await import("./PortalTabs"));
  ({ PipelineModeSelector } = await import("./pipeline/PipelineView"));
});

afterAll(() => dom.window.close());

const ITEMS = [
  { count: 12, id: "hotels", label: "Hotels" },
  { disabled: true, id: "blocked", label: "Blocked" },
  { id: "rooming", label: "Rooming" },
  { id: "room-count", label: "Room Count" },
];
function Harness({ label = "Rooms", selectionMode = "automatic" }) {
  const [value, setValue] = useState("rooming");
  return (
    <PortalTabs
      ariaLabel={label}
      items={ITEMS}
      onValueChange={setValue}
      selectionMode={selectionMode}
      value={value}
    >
      <p>{value} content</p>
    </PortalTabs>
  );
}

async function settleTabs() {
  await act(async () => new Promise((resolve) => setTimeout(resolve, 10)));
}

describe("Mounted portal tabs", () => {
  test("Uses instance-scoped ownership and renders every controlled panel", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () =>
      root.render(
        <>
          <Harness label="First" />
          <Harness label="Second" />
        </>
      )
    );
    await settleTabs();

    const tabs = [...container.querySelectorAll('[role="tab"]')];
    const ids = tabs.map((tab) => tab.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const tab of tabs) {
      expect(container.querySelector(`#${tab.getAttribute("aria-controls")}`)).not.toBeNull();
    }
    for (const panel of container.querySelectorAll('[role="tabpanel"]')) {
      expect(container.querySelector(`#${panel.getAttribute("aria-labelledby")}`)).not.toBeNull();
    }
    expect(container.querySelectorAll('[role="tabpanel"]').length).toBe(ITEMS.length * 2);
    expect(container.querySelectorAll('[role="tabpanel"]:not([hidden])').length).toBe(2);
    expect(container.querySelectorAll('[role="tabpanel"] p').length).toBe(2);
    await act(async () => root.unmount());
    container.remove();
  });

  test("Preserves count pills, disabled state, and horizontally scrollable Staff recipe", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => root.render(<Harness />));
    await settleTabs();

    const list = container.querySelector('[role="tablist"]');
    const hotels = container.querySelector('[data-tab-id="hotels"]');
    const blocked = container.querySelector('[data-tab-id="blocked"]');
    expect(list?.className).toContain("overflow-x-auto");
    expect(hotels?.textContent).toContain("Hotels12");
    expect(blocked?.getAttribute("aria-disabled")).toBe("true");
    await act(async () => blocked?.click());
    expect(container.querySelector('[data-tab-id="rooming"]')?.getAttribute("aria-selected")).toBe(
      "true"
    );

    await act(async () => root.unmount());
  });

  test("Moves content synchronously into only the newly selected owned panel", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(<Harness />));
    await settleTabs();

    const hotelsTab = container.querySelector('[data-tab-id="hotels"]');
    const roomingTab = container.querySelector('[data-tab-id="rooming"]');
    const hotelsPanel = container.querySelector(`#${hotelsTab?.getAttribute("aria-controls")}`);
    const roomingPanel = container.querySelector(`#${roomingTab?.getAttribute("aria-controls")}`);

    await act(async () => hotelsTab?.click());
    expect(hotelsPanel?.hasAttribute("hidden")).toBe(false);
    expect(hotelsPanel?.textContent).toContain("hotels content");
    expect(hotelsPanel?.querySelector("[style]")).toBeNull();
    expect(roomingPanel?.hasAttribute("hidden")).toBe(true);
    expect(roomingPanel?.textContent).not.toContain("rooming content");

    await act(async () => root.unmount());
    container.remove();
  });

  test("Wraps with arrow keys, skips disabled tabs, and supports Home and End", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(<Harness />));
    await settleTabs();

    const rooming = container.querySelector('[data-tab-id="rooming"]');
    rooming?.focus();
    await act(async () => {
      rooming?.dispatchEvent(
        new dom.window.KeyboardEvent("keydown", { bubbles: true, key: "ArrowLeft" })
      );
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(container.querySelector('[data-tab-id="hotels"]')?.getAttribute("aria-selected")).toBe(
      "true"
    );

    const hotels = container.querySelector('[data-tab-id="hotels"]');
    await act(async () => {
      hotels?.dispatchEvent(new dom.window.KeyboardEvent("keydown", { bubbles: true, key: "End" }));
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(
      container.querySelector('[data-tab-id="room-count"]')?.getAttribute("aria-selected")
    ).toBe("true");
    expect(document.activeElement?.getAttribute("data-tab-id")).toBe("room-count");

    const roomCount = container.querySelector('[data-tab-id="room-count"]');
    await act(async () => {
      roomCount?.dispatchEvent(
        new dom.window.KeyboardEvent("keydown", { bubbles: true, key: "Home" })
      );
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(container.querySelector('[data-tab-id="hotels"]')?.getAttribute("aria-selected")).toBe(
      "true"
    );
    expect(document.activeElement?.getAttribute("data-tab-id")).toBe("hotels");

    await act(async () => {
      roomCount?.focus();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(
      container.querySelector('[data-tab-id="room-count"]')?.getAttribute("aria-selected")
    ).toBe("true");
    await act(async () => {
      roomCount?.dispatchEvent(
        new dom.window.KeyboardEvent("keydown", { bubbles: true, key: "ArrowRight" })
      );
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(container.querySelector('[data-tab-id="hotels"]')?.getAttribute("aria-selected")).toBe(
      "true"
    );
    expect(document.activeElement?.getAttribute("data-tab-id")).toBe("hotels");

    await act(async () => root.unmount());
    container.remove();
  });

  test("Manual mode moves focus without changing the controlled selection", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(<Harness selectionMode="manual" />));
    await settleTabs();

    const rooming = container.querySelector('[data-tab-id="rooming"]');
    rooming?.focus();
    await act(async () => {
      rooming?.dispatchEvent(
        new dom.window.KeyboardEvent("keydown", { bubbles: true, key: "ArrowLeft" })
      );
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(document.activeElement?.getAttribute("data-tab-id")).toBe("hotels");
    expect(container.querySelector('[data-tab-id="rooming"]')?.getAttribute("aria-selected")).toBe(
      "true"
    );
    expect(container.querySelector('[data-tab-id="hotels"]')?.getAttribute("aria-selected")).toBe(
      "false"
    );

    await act(async () => document.activeElement?.click());
    expect(container.querySelector('[data-tab-id="hotels"]')?.getAttribute("aria-selected")).toBe(
      "true"
    );

    await act(async () => root.unmount());
    container.remove();
  });

  test("Announces and keyboard-selects the Pipeline perspective", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    function PipelineHarness() {
      const [mode, setMode] = useState("sales");
      return <PipelineModeSelector mode={mode} setMode={setMode} />;
    }
    await act(async () => root.render(<PipelineHarness />));

    const sales = container.querySelector('[data-mode="sales"]');
    expect(sales?.getAttribute("aria-checked")).toBe("true");
    await act(async () => {
      sales?.dispatchEvent(
        new dom.window.KeyboardEvent("keydown", { bubbles: true, key: "ArrowRight" })
      );
      await Promise.resolve();
    });
    expect(container.querySelector('[data-mode="contracting"]')?.getAttribute("aria-checked")).toBe(
      "true"
    );
    expect(document.activeElement?.getAttribute("data-mode")).toBe("contracting");

    await act(async () => root.unmount());
    container.remove();
  });
});
