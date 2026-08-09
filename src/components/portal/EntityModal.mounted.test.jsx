import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";

let createRoot;
let EntityModal;

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/portal/queries",
});

beforeAll(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Element = dom.window.Element;
  globalThis.Node = dom.window.Node;
  globalThis.MutationObserver = dom.window.MutationObserver;
  globalThis.getComputedStyle = dom.window.getComputedStyle;
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  globalThis.cancelAnimationFrame = (frame) => clearTimeout(frame);
  dom.window.requestAnimationFrame = globalThis.requestAnimationFrame;
  dom.window.cancelAnimationFrame = globalThis.cancelAnimationFrame;
  const matchMedia = (query) => ({
    addEventListener: () => undefined,
    addListener: () => undefined,
    dispatchEvent: () => false,
    matches: false,
    media: String(query),
    onchange: null,
    removeEventListener: () => undefined,
    removeListener: () => undefined,
  });
  globalThis.matchMedia = matchMedia;
  dom.window.matchMedia = matchMedia;
  ({ createRoot } = await import("react-dom/client"));
  ({ EntityModal } = await import("./EntityModal"));
});

afterAll(() => dom.window.close());

const doNothing = () => undefined;
const hasNoPermission = () => false;
const submitNothing = async () => undefined;
const settleDialog = () => new Promise((resolve) => setTimeout(resolve, 350));

describe("mounted EntityModal loading boundary", () => {
  test("stays closed while route-scoped collections are still loading", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    await act(async () =>
      root.render(
        <EntityModal
          access={{}}
          close={doNothing}
          error=""
          form={{}}
          has={hasNoPermission}
          isSaving={false}
          modal={null}
          patchForm={doNothing}
          submit={submitNothing}
          updateForm={doNothing}
        />
      )
    );

    expect(container.querySelector('[role="dialog"]')).toBeNull();

    await act(async () => root.unmount());
  });

  test("shows deterministic focused-detail loading and missing states", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const props = {
      access: {},
      close: doNothing,
      error: "",
      has: hasNoPermission,
      isSaving: false,
      modal: "query",
      patchForm: doNothing,
      submit: submitNothing,
      updateForm: doNothing,
    };

    await act(async () =>
      root.render(
        <EntityModal {...props} form={{ _focusedDetailState: "loading", entityId: "query_1" }} />
      )
    );
    await act(settleDialog);
    expect(document.body.textContent).toContain("Loading the current record");
    expect(document.querySelector('[data-testid="portal-entity-modal-save"]')?.disabled).toBe(true);

    await act(async () =>
      root.render(
        <EntityModal {...props} form={{ _focusedDetailState: "missing", entityId: "query_1" }} />
      )
    );
    await act(settleDialog);
    expect(document.body.textContent).toContain("no longer available");
    expect(document.querySelector('[data-testid="portal-entity-modal-save"]')?.disabled).toBe(true);

    await act(async () => root.unmount());
    container.remove();
  });
});
