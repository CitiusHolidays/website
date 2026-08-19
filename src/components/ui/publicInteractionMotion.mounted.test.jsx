// biome-ignore-all lint/performance/noJsxPropsBind: mounted test callbacks are intentionally local to the harness.
import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act, useState } from "react";
import { createRoot } from "react-dom/client";

let AnimatedSubmitButton;
let AuthLoginForm;
let ChatbotWindow;

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  pretendToBeVisual: true,
  url: "https://citiusholidays.com",
});

beforeAll(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Element = dom.window.Element;
  globalThis.Node = dom.window.Node;
  globalThis.Event = dom.window.Event;
  globalThis.MouseEvent = dom.window.MouseEvent;
  globalThis.MutationObserver = dom.window.MutationObserver;
  globalThis.getComputedStyle = dom.window.getComputedStyle;
  globalThis.localStorage = dom.window.localStorage;
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  globalThis.cancelAnimationFrame = (frame) => clearTimeout(frame);
  dom.window.requestAnimationFrame = globalThis.requestAnimationFrame;
  dom.window.cancelAnimationFrame = globalThis.cancelAnimationFrame;
  dom.window.matchMedia = () => ({
    addEventListener() {
      // Motion subscribes to preference changes; the fixture stays non-reduced.
    },
    matches: false,
    removeEventListener() {
      // Motion cleanup mirrors the inert fixture subscription above.
    },
  });
  globalThis.matchMedia = dom.window.matchMedia;
  globalThis.ResizeObserver = class {
    disconnect() {
      // The fixture does not emit resize records.
    }
    observe() {
      // The fixture does not emit resize records.
    }
    unobserve() {
      // The fixture does not emit resize records.
    }
  };
  ({ default: AnimatedSubmitButton } = await import("./AnimatedSubmitButton"));
  ({ AuthLoginForm } = await import("../auth/AuthLoginForm"));
  ({ ChatbotWindow } = await import("./ChatbotWindow"));
});

afterEach(() => {
  localStorage.clear();
  document.body.replaceChildren();
});
afterAll(() => dom.window.close());

async function mount(element) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(element));
  return {
    container,
    rerender: async (next) => act(async () => root.render(next)),
    unmount: async () => act(async () => root.unmount()),
  };
}

describe("Mounted public interaction states", () => {
  test("Concierge minimize and expand retain accessible state labels", async () => {
    const openerRef = { current: document.createElement("button") };
    const view = await mount(
      <ChatbotWindow isOpen onClose={() => undefined} openerRef={openerRef} />
    );
    await act(async () => new Promise((resolve) => setTimeout(resolve, 300)));

    const minimize = document.body.querySelector('button[aria-label="Minimize chat"]');
    expect(minimize).not.toBeNull();
    await act(async () => minimize.click());
    expect(document.body.querySelector('button[aria-label="Expand chat"]')).not.toBeNull();
    await view.unmount();
  });

  test("Concierge contact expansion keeps the composer and fixed-panel bounds reachable", async () => {
    const openerRef = { current: document.createElement("button") };
    const view = await mount(
      <ChatbotWindow isOpen onClose={() => undefined} openerRef={openerRef} />
    );
    await act(async () => new Promise((resolve) => setTimeout(resolve, 300)));

    const handoff = document.body.querySelector('button[aria-expanded="false"]:not([aria-label])');
    await act(async () => handoff.click());
    expect(document.body.querySelector('[data-concierge-handoff-form=""] form')).not.toBeNull();
    expect(document.body.querySelector('textarea[aria-label="Chat message"]')).not.toBeNull();

    const panel = document.querySelector("#citius-concierge-dialog");
    expect(panel.className).toContain("safe-area-fixed-panel");
    expect(panel.className).toContain("overflow-hidden");
    expect(panel.className).toContain("h-[min(680px,calc(100dvh-1rem))]");
    await view.unmount();
  });

  test("Password visibility keeps the input type and icon label synchronized", async () => {
    function Harness() {
      const [showPassword, setShowPassword] = useState(false);
      return (
        <AuthLoginForm
          copy={{ submitSignIn: "Sign in", submitSignUp: "Sign up" }}
          formData={{ email: "test@example.com", name: "", password: "secret" }}
          formError=""
          isLoading={false}
          mode="signin"
          onInputChange={() => undefined}
          onSubmit={(event) => event.preventDefault()}
          onToggleMode={() => undefined}
          onTogglePassword={() => setShowPassword((value) => !value)}
          showPassword={showPassword}
          variant={{ allowSignup: false }}
        />
      );
    }
    const view = await mount(<Harness />);
    const toggle = view.container.querySelector('button[aria-label="Show password"]');
    await act(async () => toggle.click());
    expect(view.container.querySelector("#auth-password")?.type).toBe("text");
    expect(view.container.querySelector('button[aria-label="Hide password"]')).not.toBeNull();
    await view.unmount();
  });

  test("Contact submit states retain a visible static label while the icon swaps", async () => {
    const view = await mount(<AnimatedSubmitButton isSubmitting={false} state="idle" />);
    expect(view.container.textContent).toContain("Send Message");
    await view.rerender(<AnimatedSubmitButton isSubmitting={false} state="success" />);
    expect(view.container.textContent).toContain("Sent!");
    expect(view.container.querySelector("svg")).not.toBeNull();
    await view.rerender(<AnimatedSubmitButton isSubmitting={false} state="error" />);
    expect(view.container.textContent).toContain("Try sending again");
    await view.unmount();
  });
});
