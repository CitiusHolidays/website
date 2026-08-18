import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { VENDOR_MAIN_ID, VendorSkipLink } from "./VendorSkipLink";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citius.example/vendor",
});

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  globalThis.MouseEvent = dom.window.MouseEvent;
  globalThis.requestAnimationFrame = (callback) => callback();
  dom.window.HTMLElement.prototype.scrollIntoView = function scrollIntoView() {
    this.dataset.scrolledIntoView = "true";
  };
});

afterAll(() => dom.window.close());

describe("Vendor bypass navigation", () => {
  test("Activation focuses and scrolls the primary main destination", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(() =>
      root.render(
        <>
          <VendorSkipLink />
          <header>Vendor header</header>
          <main id={VENDOR_MAIN_ID} tabIndex={-1}>
            Vendor workspace
          </main>
        </>
      )
    );

    const link = container.querySelector("a");
    const main = container.querySelector("main");
    expect(link?.textContent).toBe("Skip to main content");
    expect(link?.getAttribute("href")).toBe("#vendor-main");
    expect(container.querySelectorAll("main")).toHaveLength(1);

    await act(() => link?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(document.activeElement).toBe(main);
    expect(main?.dataset.scrolledIntoView).toBe("true");

    await act(() => root.unmount());
    container.remove();
  });
});
