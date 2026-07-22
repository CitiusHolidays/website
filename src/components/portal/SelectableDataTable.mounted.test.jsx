import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { SelectableDataTable } from "@/components/portal/SelectableDataTable";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/portal/queries",
});

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  globalThis.Event = dom.window.Event;
  globalThis.ResizeObserver = class {
    observe() {}
    disconnect() {}
  };
});

afterAll(() => dom.window.close());

describe("SelectableDataTable horizontal scroll", () => {
  test("renders accessible scroll controls when desktop table overflows", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const wideColumns = Array.from({ length: 8 }, (_, index) => ({
      id: `col-${index}`,
      label: `Column ${index}`,
      render: (row) => row.id,
      width: 240,
    }));

    await act(async () => {
      root.render(
        <SelectableDataTable
          columns={wideColumns}
          empty="No rows"
          rows={[{ id: "row-1", queryCode: "Q-0001" }]}
        />
      );
    });

    const scrollContainer = container.querySelector(".overflow-x-auto");
    Object.defineProperty(scrollContainer, "clientWidth", { configurable: true, value: 400 });
    Object.defineProperty(scrollContainer, "scrollWidth", { configurable: true, value: 1200 });
    Object.defineProperty(scrollContainer, "scrollLeft", {
      configurable: true,
      value: 0,
      writable: true,
    });

    await act(async () => {
      scrollContainer?.dispatchEvent(new window.Event("scroll"));
    });

    expect(container.querySelector('[aria-label="Scroll table right"]')).not.toBeNull();

    await act(async () => root.unmount());
    container.remove();
  });
});
