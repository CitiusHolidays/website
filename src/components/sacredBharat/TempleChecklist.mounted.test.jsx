import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { sacredVisitFeedbackMotion, TempleVisitFeedback } from "./TempleChecklist";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  pretendToBeVisual: true,
  url: "https://citiusholidays.com/sacred-bharat",
});

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  globalThis.MouseEvent = dom.window.MouseEvent;
  const matchMedia = (query) => ({
    addEventListener: () => undefined,
    addListener: () => undefined,
    matches: false,
    media: String(query),
    removeEventListener: () => undefined,
    removeListener: () => undefined,
  });
  globalThis.matchMedia = matchMedia;
  dom.window.matchMedia = matchMedia;
});

afterAll(() => dom.window.close());

describe("Mounted Sacred Bharat visit feedback", () => {
  test("Announces one restrained confirmation and offers a native undo", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    let undoCount = 0;
    const recordUndo = () => {
      undoCount += 1;
    };
    await act(async () =>
      root.render(
        <TempleVisitFeedback
          feedback={{ points: 98, templeId: "kashi-vishwanath", templeName: "Kashi Vishwanath" }}
          onUndo={recordUndo}
        />
      )
    );

    expect(container.querySelectorAll('[role="status"]')).toHaveLength(1);
    expect(container.textContent).toContain("+98 Soul Score points");
    const undo = container.querySelector("button");
    expect(undo?.textContent).toBe("Undo");
    await act(async () => undo?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(undoCount).toBe(1);
    await act(async () => root.unmount());
  });

  test("Removes spatial travel when reduced motion is requested", () => {
    const reduced = sacredVisitFeedbackMotion(true);
    expect(reduced.initial.transform).toBe("translateY(0)");
    expect(reduced.exit.transform).toBe("translateY(0)");
  });
});
