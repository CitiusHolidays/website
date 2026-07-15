import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryRowActions } from "./QueryRowActions";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/portal/queries",
});

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  globalThis.KeyboardEvent = dom.window.KeyboardEvent;
  globalThis.Event = dom.window.Event;
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
});

afterAll(() => dom.window.close());

describe("QueryRowActions", () => {
  test("opens an anchored menu with aria-haspopup menu and closes on Escape", async () => {
    let overflowClicked = false;
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () =>
      root.render(
        <QueryRowActions
          label="Q-1001"
          overflowActions={[
            <button
              aria-label="Edit query"
              key="edit"
              onClick={() => {
                overflowClicked = true;
              }}
              type="button"
            >
              Edit
            </button>,
          ]}
          primaryAction={
            <button aria-label="Open query" type="button">
              Open
            </button>
          }
        />
      )
    );

    const moreButton = container.querySelector('button[aria-label="More actions for Q-1001"]');
    expect(moreButton?.getAttribute("aria-haspopup")).toBe("menu");
    expect(container.querySelector('[role="menu"]')).toBeNull();

    await act(async () => moreButton?.click());
    expect(moreButton?.getAttribute("aria-expanded")).toBe("true");
    expect(document.querySelector('[role="menu"]')).not.toBeNull();
    expect(container.querySelector("dialog")).toBeNull();

    const backdrop = [...document.querySelectorAll("button")].find(
      (button) => button.getAttribute("aria-label") === "Close More actions for Q-1001"
    );
    await act(async () => backdrop?.click());
    expect(moreButton?.getAttribute("aria-expanded")).toBe("false");

    await act(async () => moreButton?.click());
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(moreButton?.getAttribute("aria-expanded")).toBe("false");

    await act(async () => moreButton?.click());
    const editItem = document.querySelector('[role="menuitem"][aria-label="Edit query"]');
    await act(async () => {
      editItem?.click();
      await new Promise((resolve) => setTimeout(resolve, 200));
    });
    expect(overflowClicked).toBe(true);
    expect(moreButton?.getAttribute("aria-expanded")).toBe("false");

    await act(async () => root.unmount());
    container.remove();
  });
});
