import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { PortalChromeProvider, PortalChromeSavedViewsSync } from "./PortalChromeContext";
import { usePortalChrome } from "./portalChromeState";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/portal",
});
const savedViews = [];
let createRoot;

beforeAll(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  ({ createRoot } = await import("react-dom/client"));
});

afterAll(() => dom.window.close());

describe("Portal chrome synchronization", () => {
  test("publishes changing callback implementations without a render loop", async () => {
    const calls = [];
    let renders = 0;
    let publishedActions = null;

    function WorkspaceSync() {
      renders += 1;
      const chrome = usePortalChrome();
      publishedActions = chrome.savedViewActions;
      return (
        <PortalChromeSavedViewsSync
          applySavedView={(view) => calls.push(["apply", view.id, renders])}
          deleteSavedView={(view) => calls.push(["delete", view.id, renders])}
          saveCurrentView={(name) => {
            calls.push(["save", name, renders]);
            return Promise.resolve();
          }}
          savedViews={savedViews}
          toggleSavedViewFavorite={(view) => calls.push(["favorite", view.id, renders])}
        />
      );
    }

    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(() => {
      root.render(
        <PortalChromeProvider>
          <WorkspaceSync />
        </PortalChromeProvider>
      );
    });

    expect(renders).toBeLessThanOrEqual(3);
    expect(publishedActions?.savedViews).toBe(savedViews);
    publishedActions?.applySavedView?.({ id: "saved-view-1" });
    expect(calls).toEqual([["apply", "saved-view-1", renders]]);

    await act(async () => root.unmount());
    container.remove();
  });
});
