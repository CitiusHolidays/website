import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { PortalConfirmProvider, usePortalConfirm } from "./PortalConfirmDialog";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/portal",
});

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  globalThis.KeyboardEvent = dom.window.KeyboardEvent;
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  const matchMedia = (query) => ({
    addEventListener: () => {},
    addListener: () => {},
    dispatchEvent: () => false,
    matches: /prefers-reduced-motion:\s*reduce/.test(String(query)),
    media: String(query),
    onchange: null,
    removeEventListener: () => {},
    removeListener: () => {},
  });
  dom.window.matchMedia = matchMedia;
  globalThis.matchMedia = matchMedia;
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

function Harness({ action, danger = true, onResult }) {
  const { confirm } = usePortalConfirm();
  return (
    <div aria-label="Nested entity modal" role="dialog">
      <button
        onClick={async () => {
          const result = await confirm({
            confirmLabel: "Delete",
            danger,
            message: "Delete this record?",
            onConfirm: action,
            title: "Delete record",
          });
          onResult(result);
        }}
        type="button"
      >
        Open confirm
      </button>
    </div>
  );
}


describe("mounted portal confirmation", () => {
  test("enters safely, traps focus, cancels with Cancel, and restores the nested trigger", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    let result;
    await renderHarness(root, { action: undefined, onResult: (value) => (result = value) });
    const trigger = container.querySelector("button");
    trigger.focus();
    await act(async () => trigger.click());
    await act(async () => {
      await Promise.resolve();
    });

    const dialog = container.querySelector('[role="alertdialog"]');
    const [cancel, confirm] = dialog.querySelectorAll("button");
    expect(document.activeElement).toBe(cancel);
    expect(container.querySelector('[aria-hidden="true"][inert]')).not.toBeNull();

    cancel.focus();
    await act(async () =>
      cancel.dispatchEvent(
        new dom.window.KeyboardEvent("keydown", { bubbles: true, key: "Tab", shiftKey: true })
      )
    );
    expect(document.activeElement).toBe(confirm);
    await act(async () =>
      confirm.dispatchEvent(new dom.window.KeyboardEvent("keydown", { bubbles: true, key: "Tab" }))
    );
    expect(document.activeElement).toBe(cancel);

    await act(async () => cancel.click());
    expect(result).toBe(false);
    expect(document.activeElement).toBe(trigger);

    await act(async () => root.unmount());
    container.remove();
  });

  test("runs a destructive action once, exposes pending state, and reports recoverable errors", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const firstAttempt = deferred();
    let attempts = 0;
    let shouldFail = false;
    let result;
    const action = async () => {
      attempts += 1;
      if (shouldFail) {
        throw new Error("Deletion was rejected");
      }
      await firstAttempt.promise;
    };
    await renderHarness(root, {
      action,
      danger: false,
      onResult: (value) => (result = value),
    });
    const trigger = container.querySelector("button");
    trigger.focus();
    await act(async () => trigger.click());
    let confirm = [...container.querySelectorAll('[role="alertdialog"] button')].at(-1);
    await act(async () => {
      confirm.click();
      confirm.click();
    });
    expect(attempts).toBe(1);
    expect(confirm.disabled).toBe(true);
    expect(confirm.textContent).toContain("Delete");
    await act(async () => firstAttempt.resolve());
    expect(result).toBe(true);
    expect(document.activeElement).toBe(trigger);

    shouldFail = true;
    await act(async () => trigger.click());
    confirm = [...container.querySelectorAll('[role="alertdialog"] button')].at(-1);
    await act(async () => confirm.click());
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "Deletion was rejected"
    );
    expect(container.querySelector('[role="alertdialog"]')).not.toBeNull();
    expect(document.activeElement?.textContent).toBe("Cancel");

    await act(async () => container.querySelector('[role="alertdialog"] button').click());
    expect(result).toBe(false);
    expect(document.activeElement).toBe(trigger);

    await act(async () => root.unmount());
    container.remove();
  });

  test("shows hold-to-confirm affordance for destructive actions", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await renderHarness(root, { action: undefined, onResult: () => {} });
    const trigger = container.querySelector("button");
    await act(async () => trigger.click());
    const confirm = [...container.querySelectorAll('[role="alertdialog"] button')].at(-1);
    expect(confirm.textContent).toContain("Hold to delete");
    await act(async () => root.unmount());
    container.remove();
  });
});
