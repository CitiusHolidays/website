import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { act } from "react";
import { formatDisplayDateInputDigits, isoDayFromDisplayDate } from "@/lib/formatDate";
import { PortalDateInput } from "./PortalDateInput";

let createRoot;

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/portal",
});

function mobileInputRuleDeclarations() {
  const css = readFileSync("src/app/globals.css", "utf8");
  expect(css).toMatch(
    /@media \(max-width: 767px\) \{[\s\S]*?input:not\(\[type="checkbox"\]\):not\(\[type="radio"\]\):not\(\[type="range"\]\),[\s\S]*?font-size: 1rem !important;/
  );
  return 'input:not([type="checkbox"]):not([type="radio"]):not([type="range"]), select, textarea { font-size: 1rem !important; }';
}

function setViewportWidth(width) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: width,
    writable: true,
  });
  window.matchMedia = (query) => ({
    addEventListener() {},
    matches: query.includes("767px") ? width <= 767 : false,
    removeEventListener() {},
  });
}

function injectMobileInputCss() {
  const style = document.createElement("style");
  style.setAttribute("data-testid", "portal-mobile-input-css");
  // JSDOM does not evaluate media queries; apply the active mobile declarations directly.
  style.textContent = mobileInputRuleDeclarations();
  document.head.appendChild(style);
  return style;
}

beforeAll(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  globalThis.Event = dom.window.Event;
  globalThis.InputEvent = dom.window.InputEvent;
  globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  setViewportWidth(390);
  ({ createRoot } = await import("react-dom/client"));
});

afterAll(() => dom.window.close());

describe("mounted PortalDateInput", () => {
  test("displays DD/MM/YYYY from an ISO value", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () =>
      root.render(
        <PortalDateInput
          aria-label="Travel start date"
          onChange={() => undefined}
          value="2026-06-04"
        />
      )
    );

    const textInput = container.querySelector('input[type="text"]');
    expect(textInput.value).toBe("04/06/2026");
    expect(textInput.className).toContain("text-sm");

    await act(async () => root.unmount());
    container.remove();
  });

  test("formats eight typed digits and resolves them to ISO storage", () => {
    const display = formatDisplayDateInputDigits("04062026");
    expect(display).toBe("04/06/2026");
    expect(isoDayFromDisplayDate(display)).toBe("2026-06-04");
  });

  test("keeps the hidden native date picker wired to ISO value and onChange", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    let pickerOpened = false;
    await act(async () =>
      root.render(
        <PortalDateInput
          aria-label="Travel end date"
          onChange={() => undefined}
          value="2026-06-04"
        />
      )
    );

    const nativeInput = container.querySelector('input[type="date"]');
    expect(nativeInput.value).toBe("2026-06-04");
    expect(nativeInput.getAttribute("aria-label")).toBe("Travel end date calendar picker");
    nativeInput.showPicker = () => {
      pickerOpened = true;
    };

    await act(async () => nativeInput.click());
    expect(pickerOpened).toBe(true);

    await act(async () => root.unmount());
    container.remove();
  });

  test("applies the mobile input font-size rule to text and native date inputs at 390px", async () => {
    const style = injectMobileInputCss();
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () =>
      root.render(
        <PortalDateInput aria-label="Filter from date" onChange={() => {}} value="2026-01-15" />
      )
    );

    const textInput = container.querySelector('input[type="text"]');
    const nativeInput = container.querySelector('input[type="date"]');
    expect(textInput.className).toContain("text-sm");
    expect(getComputedStyle(textInput).fontSize).toBe("1rem");
    expect(getComputedStyle(nativeInput).fontSize).toBe("1rem");

    await act(async () => root.unmount());
    container.remove();
    style.remove();
  });
});
