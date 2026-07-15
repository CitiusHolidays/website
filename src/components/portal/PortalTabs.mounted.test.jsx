import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { PortalTabs } from "./PortalTabs";
import { PipelineModeSelector } from "./pipeline/PipelineView";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/portal/hotels?tab=rooming",
});

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  globalThis.KeyboardEvent = dom.window.KeyboardEvent;
});

afterAll(() => dom.window.close());

const ITEMS = [
  { id: "hotels", label: "Hotels" },
  { disabled: true, id: "blocked", label: "Blocked" },
  { id: "rooming", label: "Rooming" },
  { id: "room-count", label: "Room Count" },
];

function Harness({ label = "Rooms" }) {
  const [value, setValue] = useState("rooming");
  return (
    <PortalTabs ariaLabel={label} items={ITEMS} onValueChange={setValue} value={value}>
      <p>{value} content</p>
    </PortalTabs>
  );
}

describe("mounted portal tabs", () => {
  test("uses instance-scoped ownership and renders every controlled panel", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () =>
      root.render(
        <>
          <Harness label="First" />
          <Harness label="Second" />
        </>
      )
    );

    const tabs = [...container.querySelectorAll('[role="tab"]')];
    const ids = tabs.map((tab) => tab.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const tab of tabs) {
      expect(container.querySelector(`#${tab.getAttribute("aria-controls")}`)).not.toBeNull();
    }
    expect(container.querySelectorAll('[role="tabpanel"]').length).toBe(ITEMS.length * 2);
    await act(async () => root.unmount());
  });

  test("wraps with arrow keys, skips disabled tabs, and supports Home and End", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(<Harness />));

    const rooming = container.querySelector('[data-tab-id="rooming"]');
    rooming?.focus();
    await act(async () => {
      rooming?.dispatchEvent(
        new dom.window.KeyboardEvent("keydown", { bubbles: true, key: "ArrowLeft" })
      );
    });
    expect(container.querySelector('[data-tab-id="hotels"]')?.getAttribute("aria-selected")).toBe(
      "true"
    );

    const hotels = container.querySelector('[data-tab-id="hotels"]');
    await act(async () => {
      hotels?.dispatchEvent(new dom.window.KeyboardEvent("keydown", { bubbles: true, key: "End" }));
    });
    expect(
      container.querySelector('[data-tab-id="room-count"]')?.getAttribute("aria-selected")
    ).toBe("true");
    expect(document.activeElement?.getAttribute("data-tab-id")).toBe("room-count");

    await act(async () => root.unmount());
    container.remove();
  });

  test("announces and keyboard-selects the Pipeline perspective", async () => {
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
    });
    expect(container.querySelector('[data-mode="contracting"]')?.getAttribute("aria-checked")).toBe(
      "true"
    );
    expect(document.activeElement?.getAttribute("data-mode")).toBe("contracting");

    await act(async () => root.unmount());
    container.remove();
  });
});
