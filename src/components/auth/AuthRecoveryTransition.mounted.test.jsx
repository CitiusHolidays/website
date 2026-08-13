import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { AuthRecoveryTransition } from "./AuthRecoveryTransition";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/auth/forgot-password",
});

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Element = dom.window.Element;
  globalThis.Node = dom.window.Node;
  globalThis.Event = dom.window.Event;
  globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
  globalThis.window.matchMedia = (query) => ({
    addEventListener: () => undefined,
    matches: query.includes("prefers-reduced-motion"),
    removeEventListener: () => undefined,
  });
});

afterEach(() => document.body.replaceChildren());
afterAll(() => dom.window.close());

describe("mounted auth recovery transition", () => {
  test("announces completion immediately while removing the exiting form from interaction", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <AuthRecoveryTransition paneKey="form">
          <form data-testid="recovery-form">
            <input aria-label="Email" />
          </form>
        </AuthRecoveryTransition>
      );
    });

    await act(async () => {
      root.render(
        <AuthRecoveryTransition announcement="Reset link sent" paneKey="success">
          <p data-testid="recovery-success">Check your inbox</p>
        </AuthRecoveryTransition>
      );
      await Promise.resolve();
    });

    expect(container.querySelector('[aria-live="polite"]')?.textContent).toBe("Reset link sent");
    const exitingPane = container.querySelector('[data-auth-recovery-pane="form"]');
    expect(exitingPane?.hasAttribute("inert")).toBe(true);
    expect(exitingPane?.getAttribute("aria-hidden")).toBe("true");

    await act(async () => root.unmount());
  });
});
