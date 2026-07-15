import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { GuestMergeStatus } from "./GuestSaveBanner";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/sacred-bharat",
});

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  globalThis.Event = dom.window.Event;
  globalThis.MouseEvent = dom.window.MouseEvent;
});

afterAll(() => dom.window.close());

async function mountStatus(props) {
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () => root.render(<GuestMergeStatus {...props} />));
  return { container, unmount: async () => act(async () => root.unmount()) };
}

describe("mounted Sacred Bharat guest merge status", () => {
  test("announces syncing and success without exposing identifiers", async () => {
    const syncing = await mountStatus({ mergeStatus: "syncing" });
    expect(syncing.container.querySelector('[role="status"]')?.getAttribute("aria-busy")).toBe(
      "true"
    );
    expect(syncing.container.textContent).toContain("Saving your local pilgrimage");
    expect(syncing.container.textContent).not.toContain("authUserId");
    await syncing.unmount();

    const success = await mountStatus({ mergeStatus: "success" });
    expect(success.container.textContent).toContain("saved to your account");
    await success.unmount();
  });

  test("shows a keyboard-native retry after failure", async () => {
    let retries = 0;
    const view = await mountStatus({
      hasGuestDraft: true,
      mergeStatus: "error",
      retryGuestMerge: () => {
        retries += 1;
      },
    });
    const button = view.container.querySelector("button");

    expect(view.container.querySelector('[role="alert"]')).not.toBeNull();
    expect(button?.textContent).toContain("Retry saving");
    await act(async () => button.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(retries).toBe(1);
    expect(view.container.textContent).not.toContain("private server detail");
    await view.unmount();
  });
});
