import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act, useCallback, useState } from "react";

const REDUCED_MOTION_QUERY = /prefers-reduced-motion:\s*reduce/;
const doNothing = () => undefined;
const hasNoPermission = () => false;

let createRoot;
let ConvexProvider;
let ConvexReactClient;
let EntityModal;
let convexClient;

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  pretendToBeVisual: true,
  url: "https://citiusholidays.com/portal/queries",
});

beforeAll(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
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
  ({ ConvexProvider, ConvexReactClient } = await import("convex/react"));
  convexClient = new ConvexReactClient("https://entity-modal-shell-test.convex.cloud", {
    logger: false,
  });
  ({ EntityModal } = await import("../EntityModal"));
});

afterAll(async () => {
  await convexClient.close();
  dom.window.close();
});

function flushDialogFrame() {
  return act(async () => new Promise((resolve) => setTimeout(resolve, 350)));
}

function Harness({
  fieldErrors = {},
  form = {},
  isSaving = false,
  modalType = "proposal",
  onClose,
  onSubmit,
}) {
  const [modal, setModal] = useState(null);
  const close = useCallback(() => {
    setModal(null);
    onClose();
  }, [onClose]);
  const open = useCallback(() => setModal(modalType), [modalType]);
  return (
    <>
      <button data-testid="entity-trigger" onClick={open} type="button">
        Open entity
      </button>
      <EntityModal
        access={{}}
        close={close}
        error=""
        fieldErrors={fieldErrors}
        form={form}
        has={hasNoPermission}
        isSaving={isSaving}
        modal={modal}
        patchForm={doNothing}
        pendingExpenseProofFiles={[]}
        submit={onSubmit}
        updateForm={doNothing}
      />
    </>
  );
}

function renderHarness(root, props) {
  return act(async () =>
    root.render(
      <ConvexProvider client={convexClient}>
        <Harness {...props} />
      </ConvexProvider>
    )
  );
}

async function verifyEntityClose(closeMethod) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  let closes = 0;
  await renderHarness(root, {
    onClose: () => {
      closes += 1;
    },
    onSubmit: doNothing,
  });
  const trigger = container.querySelector('[data-testid="entity-trigger"]');
  trigger.focus();
  await act(async () => trigger.click());
  await flushDialogFrame();

  act(() => {
    if (closeMethod === "outside") {
      const backdrop = document.querySelector(".portal-entity-modal-backdrop");
      backdrop.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
      backdrop.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    } else {
      document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }));
    }
  });
  await flushDialogFrame();
  expect(closes).toBe(1);
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(document.activeElement).toBe(trigger);

  await act(async () => root.unmount());
  container.remove();
}

describe("mounted entity modal shell", () => {
  test("focuses the first inline-invalid field without creating a modal error alert", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const validationProps = {
      form: { category: "", expenseType: "office" },
      modalType: "expense",
      onClose: doNothing,
      onSubmit: doNothing,
    };
    await renderHarness(root, validationProps);
    await act(async () => container.querySelector('[data-testid="entity-trigger"]').click());
    await flushDialogFrame();
    await renderHarness(root, {
      ...validationProps,
      fieldErrors: { category: "Select Category." },
    });
    await flushDialogFrame();

    const invalid = document.querySelector('[role="combobox"][aria-invalid="true"]');
    expect(invalid?.textContent).toContain("Select category");
    expect(document.activeElement).toBe(invalid);
    expect(document.querySelector("#portal-entity-modal-error")).toBeNull();

    await act(async () => root.unmount());
    container.remove();
  });

  test("preserves the shell geometry, responsive recipes, semantic labelling, and focus loop", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await renderHarness(root, { onClose: doNothing, onSubmit: doNothing });
    const trigger = container.querySelector('[data-testid="entity-trigger"]');
    trigger.focus();
    await act(async () => trigger.click());
    await flushDialogFrame();

    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog.hasAttribute("data-starting-style")).toBe(false);
    expect(getComputedStyle(dialog).opacity).not.toBe("0");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(document.getElementById(dialog.getAttribute("aria-labelledby"))?.textContent).toBe(
      "Create Proposal"
    );
    expect(dialog.tagName).toBe("FORM");
    expect(dialog.className).toContain("max-w-3xl");
    expect(dialog.className).toContain("max-h-[90vh]");
    expect(dialog.className).toContain("max-sm:h-[100dvh]");
    expect(dialog.parentElement.className).toContain("z-[80]");
    expect(document.querySelector(".portal-entity-modal-backdrop")).not.toBeNull();
    expect(dialog.contains(document.activeElement)).toBe(true);

    const [beforeGuard, afterGuard] = dialog.parentElement.querySelectorAll(
      '[data-base-ui-focus-guard][data-type="inside"]'
    );
    const cancel = dialog.querySelector('[data-testid="portal-entity-modal-cancel"]');
    const save = dialog.querySelector('[data-testid="portal-entity-modal-save"]');
    await act(async () => {
      beforeGuard.focus();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(document.activeElement).toBe(save);
    await act(async () => {
      afterGuard.focus();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(cancel.className).toContain("max-sm:w-full");
    expect(save.className).toContain("max-sm:w-full");

    await act(async () => root.unmount());
    container.remove();
  });

  test("focuses the popup itself when no preferred field exists", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await renderHarness(root, {
      modalType: "unknown",
      onClose: doNothing,
      onSubmit: doNothing,
    });
    const trigger = container.querySelector('[data-testid="entity-trigger"]');
    trigger.focus();
    await act(async () => trigger.click());
    await flushDialogFrame();

    const dialog = document.querySelector('[data-testid="portal-entity-modal"]');
    expect(dialog.getAttribute("tabindex")).toBe("-1");
    expect(document.activeElement).toBe(dialog);

    await act(async () => root.unmount());
    container.remove();
  });

  test("closes through outside interaction and Escape and restores the opener", async () => {
    await verifyEntityClose("outside");
    await verifyEntityClose("escape");
  });

  test("preserves form submission and saving guards", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    let submits = 0;
    const onSubmit = (event) => {
      event.preventDefault();
      submits += 1;
    };
    await renderHarness(root, { isSaving: true, onClose: doNothing, onSubmit });
    await act(async () => container.querySelector('[data-testid="entity-trigger"]').click());
    await flushDialogFrame();
    const dialog = document.querySelector('[role="dialog"]');
    const save = dialog.querySelector('[data-testid="portal-entity-modal-save"]');
    expect(save.disabled).toBe(true);
    act(() => {
      dialog.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(submits).toBe(1);

    await act(async () => root.unmount());
    container.remove();
  });
});
