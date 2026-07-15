import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { getFilterDateRangeError, resolveDateRange } from "@/lib/portal/periodFilter";
import { PortalDateRangeFilter } from "./PortalDateRangeFilter";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/portal",
});

function Harness({ initialRange, inlineError = false }) {
  const [dateRange, setDateRange] = useState(initialRange);
  return (
    <PortalDateRangeFilter
      dateRange={dateRange}
      inlineError={inlineError}
      setDateRange={setDateRange}
    />
  );
}

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
});

afterAll(() => dom.window.close());

describe("mounted PortalDateRangeFilter", () => {
  test("surfaces inverted range errors from shared period contracts without swapping dates", async () => {
    const inverted = { from: "2026-03-31", to: "2026-03-01" };
    expect(getFilterDateRangeError(inverted)).toBe("From must be on or before To.");
    expect(resolveDateRange(inverted)).toBeNull();

    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(<Harness initialRange={inverted} />));

    expect(container.textContent).toContain("From must be on or before To.");
    const textInputs = container.querySelectorAll('input[type="text"]');
    expect(textInputs).toHaveLength(2);
    expect(container.querySelector('input[type="date"]')).not.toBeNull();

    await act(async () => root.unmount());
    container.remove();
  });

  test("shows inline inverted range errors when requested by list toolbar", async () => {
    const inverted = { from: "2026-04-10", to: "2026-04-01" };
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(<Harness initialRange={inverted} inlineError />));

    const alert = container.querySelector('[role="alert"]');
    expect(alert?.textContent).toBe("From must be on or before To.");
    expect(alert?.id).toMatch(/-error$/);

    await act(async () => root.unmount());
    container.remove();
  });

  test("keeps fixed-width non-shrinking toolbar controls for date inputs and clear action", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () =>
      root.render(<Harness initialRange={{ from: "2026-01-01", to: "2026-01-31" }} />)
    );

    const wrapper = container.firstElementChild;
    expect(wrapper?.className).toContain("shrink-0");
    expect(container.querySelector(".flex.flex-nowrap")).not.toBeNull();
    expect(container.querySelector("label.shrink-0")).not.toBeNull();

    for (const textInput of container.querySelectorAll('input[type="text"]')) {
      expect(textInput.className).toContain("!w-[9.5rem]");
      expect(textInput.className).toContain("!min-w-[9.5rem]");
      expect(textInput.className).toContain("!max-w-[9.5rem]");
    }

    const clearButton = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Clear dates")
    );
    expect(clearButton?.className).toContain("shrink-0");

    await act(async () => root.unmount());
    container.remove();
  });
});
