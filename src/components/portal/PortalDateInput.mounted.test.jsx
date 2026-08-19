import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { formatDisplayDateInputDigits, isoDayFromDisplayDate } from "@/lib/formatDate";
import { PortalDateInput } from "./PortalDateInput";

const noop = () => undefined;
let createRoot;

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/portal",
});

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
  ({ createRoot } = await import("react-dom/client"));
});

afterAll(() => dom.window.close());

describe("Mounted PortalDateInput", () => {
  test("Displays DD/MM/YYYY from an ISO value", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () =>
      root.render(
        <PortalDateInput aria-label="Travel start date" onChange={noop} value="2026-06-04" />
      )
    );

    const textInput = container.querySelector('input[type="text"]');
    expect(textInput.value).toBe("04/06/2026");
    expect(textInput.className).toContain("text-sm");

    await act(async () => root.unmount());
    container.remove();
  });

  test("Formats eight typed digits and resolves them to ISO storage", () => {
    const display = formatDisplayDateInputDigits("04062026");
    expect(display).toBe("04/06/2026");
    expect(isoDayFromDisplayDate(display)).toBe("2026-06-04");
  });

  test("Keeps the hidden native date picker wired to ISO value and onChange", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    let pickerOpened = false;
    await act(async () =>
      root.render(
        <PortalDateInput aria-label="Travel end date" onChange={noop} value="2026-06-04" />
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
});
