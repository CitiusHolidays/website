// biome-ignore-all lint/performance/noJsxPropsBind: mounted test callbacks stay close to their harness.
// biome-ignore-all lint/suspicious/useAwait: React act callbacks intentionally flush synchronously.

import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";

let createRoot;
let PortalToastProvider;
let usePortalToast;
let sonnerToast;

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/portal",
});
const REDUCED_MOTION_QUERY = /prefers-reduced-motion:\s*reduce/;
const noop = () => undefined;

beforeAll(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  globalThis.Event = dom.window.Event;
  globalThis.MouseEvent = dom.window.MouseEvent;
  globalThis.PointerEvent = dom.window.PointerEvent ?? dom.window.MouseEvent;
  globalThis.getComputedStyle = dom.window.getComputedStyle;
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
  dom.window.requestAnimationFrame = globalThis.requestAnimationFrame;
  dom.window.cancelAnimationFrame = globalThis.cancelAnimationFrame;
  const matchMedia = (query) => ({
    addEventListener: noop,
    addListener: noop,
    dispatchEvent: () => false,
    matches: REDUCED_MOTION_QUERY.test(String(query)),
    media: String(query),
    onchange: null,
    removeEventListener: noop,
    removeListener: noop,
  });
  dom.window.matchMedia = matchMedia;
  globalThis.matchMedia = matchMedia;
  ({ createRoot } = await import("react-dom/client"));
  ({ PortalToastProvider, usePortalToast } = await import("./PortalToast"));
  ({ toast: sonnerToast } = await import("@/components/ui/foundation/toast"));
});

afterEach(async () => {
  for (const toast of sonnerToast.getToasts()) {
    sonnerToast.dismiss(toast.id);
  }
  await settle();
  document.body.replaceChildren();
});

afterAll(() => dom.window.close());

function ToastHarness() {
  const toast = usePortalToast();
  return (
    <div>
      <button onClick={() => toast.info("Information message")} type="button">
        Info
      </button>
      <button onClick={() => toast.success("Saved successfully")} type="button">
        Success
      </button>
      <button onClick={() => toast.error("Save failed")} type="button">
        Error
      </button>
    </div>
  );
}

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function mountHarness() {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <PortalToastProvider>
        <ToastHarness />
      </PortalToastProvider>
    )
  );
  return { container, root };
}

describe("PortalToast public contract", () => {
  test("Keeps the provider API while Sonner renders the established tones, durations, and ARIA", async () => {
    const { container, root } = await mountHarness();
    const [info, success, error] = container.querySelectorAll("button");
    await act(async () => {
      info.click();
      success.click();
      error.click();
    });
    await settle();

    const toaster = document.querySelector("[data-sonner-toaster]");
    const liveRegion = toaster.parentElement;
    const toasts = [...document.querySelectorAll('[data-sonner-toast]:not([data-removed="true"])')];
    const active = sonnerToast.getToasts().filter((toast) => toast.toasterId === "portal");

    expect(toaster.classList.contains("portal-toast-safe-area")).toBe(true);
    expect(toaster.classList.contains("z-[95]")).toBe(true);
    expect(toaster.style.zIndex).toBe("95");
    expect(toaster.style.getPropertyValue("--offset-right")).toContain("safe-area-inset-right");
    expect(toaster.style.getPropertyValue("--offset-bottom")).toContain("safe-area-inset-bottom");
    expect(toaster.style.getPropertyValue("--mobile-offset-left")).toContain(
      "safe-area-inset-left"
    );
    expect(liveRegion.getAttribute("aria-live")).toBe("polite");
    expect(liveRegion.getAttribute("aria-relevant")).toBe("additions text");
    expect(liveRegion.getAttribute("aria-atomic")).toBe("false");
    expect(liveRegion.getAttribute("aria-label")).toContain("Portal notifications");
    expect(toasts.map((toast) => toast.dataset.type).sort((a, b) => a.localeCompare(b))).toEqual([
      "error",
      "info",
      "success",
    ]);
    expect(toasts.every((toast) => toast.classList.contains("portal-sonner-toast"))).toBe(true);
    expect(toasts.map((toast) => toast.textContent)).toEqual([
      expect.stringContaining("Save failed"),
      expect.stringContaining("Saved successfully"),
      expect.stringContaining("Information message"),
    ]);
    expect(toasts.every((toast) => toast.querySelector('[role="status"]') === null)).toBe(true);
    expect(
      toasts.every(
        (toast) =>
          toast.querySelector('button[aria-label="Dismiss notification"]')?.textContent ===
          "Dismiss"
      )
    ).toBe(true);
    expect(active.map((toast) => [toast.type, toast.duration])).toEqual([
      ["info", 5000],
      ["success", 5000],
      ["error", Number.POSITIVE_INFINITY],
    ]);

    await act(async () => root.unmount());
    container.remove();
  });

  test("Caps active toasts at five, queues overflow, and reveals it after dismissal", async () => {
    const { container, root } = await mountHarness();
    const [info, success, error] = container.querySelectorAll("button");
    await act(async () => {
      info.click();
      success.click();
      error.click();
      info.click();
      success.click();
      error.click();
    });
    await settle();

    const activeBeforeDismiss = sonnerToast
      .getToasts()
      .filter((toast) => toast.toasterId === "portal");
    const visibleBeforeDismiss = document.querySelectorAll(
      '[data-sonner-toast][data-visible="true"]:not([data-removed="true"])'
    );
    expect(activeBeforeDismiss).toHaveLength(5);
    expect(visibleBeforeDismiss).toHaveLength(5);
    const dismissibleToast = [...visibleBeforeDismiss].find(
      (toast) => toast.dataset.type !== "error"
    );

    const dismiss = dismissibleToast.querySelector('button[aria-label="Dismiss notification"]');
    await act(async () => dismiss.click());
    await settle();

    const activeAfterDismiss = sonnerToast
      .getToasts()
      .filter((toast) => toast.toasterId === "portal");
    expect(activeAfterDismiss).toHaveLength(5);
    expect(activeAfterDismiss.some((toast) => toast.type === "error")).toBe(true);
    expect(dismiss.closest("[data-sonner-toast]").dataset.removed).toBe("true");

    await act(async () => root.unmount());
    container.remove();
  });
});
