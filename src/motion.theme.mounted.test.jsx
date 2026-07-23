import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/portal",
});

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  dom.window.matchMedia = (query) => ({
    addEventListener: () => {},
    addListener: () => {},
    dispatchEvent: () => false,
    matches: String(query).includes("prefers-reduced-motion"),
    media: String(query),
    onchange: null,
    removeEventListener: () => {},
    removeListener: () => {},
  });
  globalThis.matchMedia = dom.window.matchMedia;
});

afterAll(() => dom.window.close());

describe("mounted citius portal motion theme", () => {
  test("useMotionUITheme().motionMode is calm when prefers-reduced-motion is mocked", async () => {
    const React = await import("react");
    const { MotionUIThemeProvider, useMotionUITheme } = await import(
      "@/components/motion-ui/ui-theme"
    );
    const citiusTheme = (await import("@/motion.theme")).default;
    const { domAnimation, LazyMotion, MotionConfig } = await import("motion/react");

    function ThemeProbe() {
      const theme = useMotionUITheme();
      return <div data-motion-mode={theme.motionMode} data-testid="motion-theme-probe" />;
    }

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(
        <LazyMotion features={domAnimation}>
          <MotionConfig reducedMotion="always">
            <MotionUIThemeProvider theme={citiusTheme}>
              <ThemeProbe />
            </MotionUIThemeProvider>
          </MotionConfig>
        </LazyMotion>
      );
    });

    const probe = container.querySelector("[data-testid='motion-theme-probe']");
    expect(probe?.getAttribute("data-motion-mode")).toBe("calm");

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
