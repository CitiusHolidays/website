import { afterAll, beforeAll, describe, expect, mock, spyOn, test } from "bun:test";
import { JSDOM } from "jsdom";
import { m } from "motion/react";
import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { publicRevealMotion, publicStageMotion } from "@/lib/publicInteractionMotion";
import ReducedMotionProvider, { useHydratedReducedMotion } from "./ReducedMotionProvider";

function PublicMotionSample() {
  const reduced = useHydratedReducedMotion();
  return (
    <div data-reduced={String(reduced)}>
      <m.div {...publicRevealMotion(reduced)}>Policy content</m.div>
      <m.div {...publicStageMotion(reduced)}>Sacred question</m.div>
    </div>
  );
}

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
  test("Keeps server and reduced-motion first-client attributes identical", async () => {
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

  test("Hydrates public motion and every submit state before applying the client preference", async () => {
    const originalMotion = { ...(await import("motion/react")) };
    let reducedPreference = null;
    mock.module("motion/react", () => ({
      ...originalMotion,
      useReducedMotion: () => reducedPreference,
    }));
    const { default: AnimatedSubmitButton } = await import("../ui/AnimatedSubmitButton");
    const content = (
      <ReducedMotionProvider>
        <PublicMotionSample />
        {["idle", "processing", "success", "error"].map((state) => (
          <AnimatedSubmitButton isSubmitting={state === "processing"} key={state} state={state} />
        ))}
      </ReducedMotionProvider>
    );
    const container = document.createElement("div");
    container.innerHTML = renderToString(content);
    document.body.append(container);
    expect(container.querySelector('[data-reduced="false"]')).not.toBeNull();
    reducedPreference = true;
    const recoverableErrors = [];
    const consoleError = spyOn(console, "error").mockImplementation(() => undefined);
    let root;
    try {
      await act(() => {
        root = hydrateRoot(container, content, {
          onRecoverableError: (error) => recoverableErrors.push(error),
        });
      });
      expect(recoverableErrors).toEqual([]);
      expect(consoleError).not.toHaveBeenCalled();
      expect(container.querySelector('[data-reduced="true"]')).not.toBeNull();
      expect([...container.querySelectorAll("button")].map((button) => button.disabled)).toEqual([
        false,
        true,
        false,
        false,
      ]);
      expect(container.textContent).toContain("Sending…");
      expect(container.querySelector('[style*="rotate(0deg)"]')).not.toBeNull();
    } finally {
      await act(() => root?.unmount());
      consoleError.mockRestore();
      mock.restore();
      container.remove();
    }
  });
});
