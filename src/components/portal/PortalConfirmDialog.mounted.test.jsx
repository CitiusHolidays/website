import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act, useCallback, useRef, useState } from "react";

const REDUCED_MOTION_QUERY = /prefers-reduced-motion:\s*reduce/;
const doNothing = () => undefined;

let createRoot;
let ControlledDialog;
let ControlledDialogClose;
let ControlledDialogTitle;
let PortalConfirmProvider;
let usePortalConfirm;
let usePortalConfirmActive;

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  pretendToBeVisual: true,
  url: "https://citiusholidays.com/portal",
});

beforeAll(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.SVGElement = dom.window.SVGElement;
  globalThis.Element = dom.window.Element;
  globalThis.Node = dom.window.Node;
  globalThis.KeyboardEvent = dom.window.KeyboardEvent;
  globalThis.Event = dom.window.Event;
  globalThis.MouseEvent = dom.window.MouseEvent;
  globalThis.PointerEvent = dom.window.PointerEvent ?? dom.window.MouseEvent;
  globalThis.MutationObserver = dom.window.MutationObserver;
  globalThis.getComputedStyle = dom.window.getComputedStyle;
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
  dom.window.requestAnimationFrame = globalThis.requestAnimationFrame;
  dom.window.cancelAnimationFrame = globalThis.cancelAnimationFrame;
  const matchMedia = (query) => ({
    addEventListener: doNothing,
    addListener: doNothing,
    dispatchEvent: () => false,
    matches: REDUCED_MOTION_QUERY.test(String(query)),
    media: String(query),
    onchange: null,
    removeEventListener: doNothing,
    removeListener: doNothing,
  });
  dom.window.matchMedia = matchMedia;
  globalThis.matchMedia = matchMedia;
  ({ createRoot } = await import("react-dom/client"));
  ({ ControlledDialog, ControlledDialogClose, ControlledDialogTitle } = await import(
    "../ui/application-dialog"
  ));
  ({ PortalConfirmProvider, usePortalConfirm, usePortalConfirmActive } = await import(
    "./PortalConfirmDialog"
  ));
});

afterAll(() => dom.window.close());

function renderHarness(root, props) {
  return act(async () =>
    root.render(
      <PortalConfirmProvider>
        <Harness {...props} />
      </PortalConfirmProvider>
    )
  );
}

function deferred() {
  let reject;
  let resolve;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function flushFocusFrame() {
  return act(async () => new Promise((resolve) => setTimeout(resolve, 350)));
}

function Harness({ action, danger = true, onResult }) {
  const { confirm } = usePortalConfirm();
  const openConfirm = useCallback(async () => {
    const result = await confirm({
      confirmLabel: "Delete",
      danger,
      message: "Delete this record?",
      onConfirm: action,
      title: "Delete record",
    });
    onResult(result);
  }, [action, confirm, danger, onResult]);
  return (
    <div aria-label="Nested entity modal" role="dialog">
      <button data-testid="confirm-fallback" type="button">
        Other action
      </button>
      <button data-testid="confirm-trigger" onClick={openConfirm} type="button">
        Open confirm
      </button>
    </div>
  );
}

async function verifyFallbackRestore(openerState) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  let result;
  await renderHarness(root, {
    action: undefined,
    danger: false,
    onResult: (value) => {
      result = value;
    },
  });
  const trigger = container.querySelector('[data-testid="confirm-trigger"]');
  const fallback = container.querySelector('[data-testid="confirm-fallback"]');
  trigger.focus();
  await act(async () => trigger.click());
  await flushFocusFrame();

  const backdrop = document.querySelector(".portal-confirm-backdrop");
  const pointerDown = new PointerEvent("pointerdown", { bubbles: true, cancelable: true });
  act(() => {
    backdrop.dispatchEvent(pointerDown);
    backdrop.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  expect(pointerDown.defaultPrevented).toBe(true);
  expect(document.activeElement).toBe(
    document.querySelector('[data-testid="portal-confirm-cancel"]')
  );
  expect(document.querySelector('[role="alertdialog"]')).not.toBeNull();

  if (openerState === "disabled") {
    trigger.disabled = true;
  } else {
    trigger.remove();
  }
  act(() => {
    document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }));
  });
  await flushFocusFrame();
  expect(result).toBe(false);
  expect(document.activeElement).toBe(fallback);

  await act(async () => root.unmount());
  container.remove();
}

function NestedBaseDialogHarness({ onResult }) {
  const { confirm } = usePortalConfirm();
  const confirmActive = usePortalConfirmActive();
  const [outerOpen, setOuterOpen] = useState(false);
  const removeRef = useRef(null);
  const openOuter = useCallback(() => setOuterOpen(true), []);
  const handleOuterOpenChange = useCallback((nextOpen) => setOuterOpen(nextOpen), []);
  const openConfirm = useCallback(async () => {
    const result = await confirm({
      confirmLabel: "Remove",
      danger: false,
      message: "Remove this attachment?",
      title: "Remove attachment",
    });
    onResult(result);
  }, [confirm, onResult]);

  return (
    <>
      <button data-testid="outer-dialog-trigger" onClick={openOuter} type="button">
        Open attachments
      </button>
      <ControlledDialog
        closeDisabled={confirmActive}
        initialFocus={removeRef}
        modal={!confirmActive}
        onOpenChange={handleOuterOpenChange}
        open={outerOpen}
        popupClassName="nested-base-dialog"
        popupRender={<div data-testid="nested-base-dialog" />}
        triggerless
        viewportClassName="nested-base-dialog-viewport"
      >
        <ControlledDialogTitle>Attachments</ControlledDialogTitle>
        <button data-testid="nested-remove" onClick={openConfirm} ref={removeRef} type="button">
          Remove
        </button>
        <ControlledDialogClose data-testid="nested-outer-close" type="button">
          Close attachments
        </ControlledDialogClose>
      </ControlledDialog>
    </>
  );
}

describe("Mounted portal confirmation", () => {
  test("Enters safely, traps focus, cancels with Cancel, and restores the nested trigger", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    let result;
    await renderHarness(root, {
      action: undefined,
      onResult: (value) => {
        result = value;
      },
    });
    const trigger = container.querySelector('[data-testid="confirm-trigger"]');
    trigger.focus();
    await act(async () => trigger.click());
    await flushFocusFrame();

    const dialog = document.querySelector('[role="alertdialog"]');
    const [cancel, confirm] = dialog.querySelectorAll("button");
    expect(dialog.hasAttribute("data-starting-style")).toBe(false);
    expect(getComputedStyle(dialog).opacity).not.toBe("0");
    expect(document.activeElement).toBe(cancel);
    expect(container.getAttribute("aria-hidden")).toBe("true");

    const [beforeGuard, afterGuard] = dialog.parentElement.querySelectorAll(
      '[data-base-ui-focus-guard][data-type="inside"]'
    );
    await act(async () => {
      beforeGuard.focus();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(document.activeElement).toBe(confirm);
    await act(async () => {
      afterGuard.focus();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(document.activeElement).toBe(cancel);

    await act(async () => cancel.click());
    await flushFocusFrame();
    expect(result).toBe(false);
    expect(document.activeElement).toBe(trigger);

    await act(async () => root.unmount());
    container.remove();
  });

  test("Runs a destructive action once, exposes pending state, and reports recoverable errors", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const firstAttempt = deferred();
    let attempts = 0;
    let result;
    const action = async () => {
      attempts += 1;
      await firstAttempt.promise;
    };
    await renderHarness(root, {
      action,
      danger: false,
      onResult: (value) => {
        result = value;
      },
    });
    let trigger = container.querySelector('[data-testid="confirm-trigger"]');
    trigger.focus();
    await act(async () => trigger.click());
    await flushFocusFrame();
    let confirm = [...document.querySelectorAll('[role="alertdialog"] button')].at(-1);
    act(() => {
      confirm.click();
      confirm.click();
    });
    expect(attempts).toBe(1);
    expect(confirm.disabled).toBe(true);
    expect(confirm.textContent).toContain("Delete");
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }));
      const backdrop = document.querySelector(".portal-confirm-backdrop");
      backdrop.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
      backdrop.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(document.querySelector('[role="alertdialog"]')).not.toBeNull();
    await act(async () => firstAttempt.resolve());
    await flushFocusFrame();
    expect(result).toBe(true);
    expect(document.activeElement).toBe(trigger);

    await renderHarness(root, {
      action: () => {
        attempts += 1;
        return Promise.reject(new Error("Deletion was rejected"));
      },
      danger: false,
      onResult: (value) => {
        result = value;
      },
    });
    trigger = container.querySelector('[data-testid="confirm-trigger"]');
    await act(async () => trigger.click());
    await flushFocusFrame();
    confirm = [...document.querySelectorAll('[role="alertdialog"] button')].at(-1);
    await act(async () => confirm.click());
    expect(document.querySelector('[role="alert"]')?.textContent).toContain(
      "Deletion was rejected"
    );
    expect(document.querySelector('[role="alertdialog"]')).not.toBeNull();
    expect(document.activeElement?.textContent).toBe("Cancel");

    await act(async () => document.querySelector('[role="alertdialog"] button').click());
    await flushFocusFrame();
    expect(result).toBe(false);
    expect(document.activeElement).toBe(trigger);

    await act(async () => root.unmount());
    container.remove();
  });

  test("Shows hold-to-delete affordance for destructive actions", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await renderHarness(root, { action: undefined, onResult: doNothing });
    const trigger = container.querySelector('[data-testid="confirm-trigger"]');
    await act(async () => trigger.click());
    await flushFocusFrame();
    const confirm = [...document.querySelectorAll('[role="alertdialog"] button')].at(-1);
    expect(confirm.textContent).toContain("Hold to delete");
    await act(async () => root.unmount());
    container.remove();
  });

  test("Keeps the two-second destructive hold under reduced motion", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    let result;
    await renderHarness(root, {
      action: undefined,
      onResult: (value) => {
        result = value;
      },
    });
    await act(async () => container.querySelector('[data-testid="confirm-trigger"]').click());
    await flushFocusFrame();
    const hold = document.querySelector('[data-testid="portal-confirm-hold"]');

    act(() => {
      hold.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 1 }));
    });
    await act(async () => new Promise((resolve) => setTimeout(resolve, 800)));

    expect(result).toBeUndefined();
    act(() => {
      hold.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1 }));
    });
    await act(async () => root.unmount());
    container.remove();
  });

  test("Ignores outside interaction, permits idle Escape, and restores an eligible fallback", async () => {
    await verifyFallbackRestore("disabled");
    await verifyFallbackRestore("removed");
  });

  test("Hands modal ownership to a nested alert and resumes outer containment after Escape", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    let result;
    const captureResult = (value) => {
      result = value;
    };
    await act(async () =>
      root.render(
        <PortalConfirmProvider>
          <NestedBaseDialogHarness onResult={captureResult} />
        </PortalConfirmProvider>
      )
    );
    const outerTrigger = container.querySelector('[data-testid="outer-dialog-trigger"]');
    outerTrigger.focus();
    await act(async () => outerTrigger.click());
    await flushFocusFrame();
    const remove = document.querySelector('[data-testid="nested-remove"]');
    expect(document.activeElement).toBe(remove);

    await act(async () => remove.click());
    await flushFocusFrame();
    const alert = document.querySelector('[role="alertdialog"]');
    const outerWhileNested = document.querySelector('[data-testid="nested-base-dialog"]');
    const cancel = alert.querySelector('[data-testid="portal-confirm-cancel"]');
    expect(outerWhileNested.getAttribute("aria-modal")).toBeNull();
    expect(alert.getAttribute("aria-modal")).toBe("true");
    expect(document.activeElement).toBe(cancel);

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }));
    });
    await flushFocusFrame();
    const outerDialog = document.querySelector('[data-testid="nested-base-dialog"]');
    expect(result).toBe(false);
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
    expect(outerDialog).not.toBeNull();
    expect(outerDialog.getAttribute("aria-modal")).toBe("true");
    expect(document.activeElement).toBe(remove);

    await act(async () =>
      remove.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Tab" }))
    );
    expect(outerDialog.contains(document.activeElement)).toBe(true);

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }));
    });
    await flushFocusFrame();
    expect(document.querySelector('[data-testid="nested-base-dialog"]')).toBeNull();
    expect(document.activeElement).toBe(outerTrigger);

    await act(async () => root.unmount());
    container.remove();
  });
});
