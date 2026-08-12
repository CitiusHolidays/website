import { afterAll, beforeAll, describe, expect, spyOn, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import ReducedMotionProvider from "./ReducedMotionProvider";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/auth/connect",
});

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  globalThis.Event = dom.window.Event;
  const matchMedia = (query) => ({
    addEventListener: () => undefined,
    addListener: () => undefined,
    dispatchEvent: () => false,
    matches: String(query).includes("prefers-reduced-motion"),
    media: String(query),
    onchange: null,
    removeEventListener: () => undefined,
    removeListener: () => undefined,
  });
  dom.window.matchMedia = matchMedia;
  globalThis.matchMedia = matchMedia;
});

afterAll(() => dom.window.close());

describe("ReducedMotionProvider hydration", () => {
  test("keeps server and reduced-motion first-client attributes identical", async () => {
    const child = <button type="button">Stable control</button>;
    const container = document.createElement("div");
    container.innerHTML = renderToString(<ReducedMotionProvider>{child}</ReducedMotionProvider>);
    document.body.append(container);
    const recoverableErrors = [];
    const consoleError = spyOn(console, "error").mockImplementation(() => undefined);
    let root;

    await act(() => {
      root = hydrateRoot(container, <ReducedMotionProvider>{child}</ReducedMotionProvider>, {
        onRecoverableError: (error) => recoverableErrors.push(error),
      });
    });

    expect(recoverableErrors).toEqual([]);
    expect(consoleError).not.toHaveBeenCalled();
    expect(container.textContent).toBe("Stable control");

    await act(() => root.unmount());
    consoleError.mockRestore();
    container.remove();
  });
});
