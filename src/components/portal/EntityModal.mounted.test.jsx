import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { EntityModal } from "./EntityModal";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/portal/queries",
});

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  globalThis.cancelAnimationFrame = (frame) => clearTimeout(frame);
});

afterAll(() => dom.window.close());

const doNothing = () => undefined;
const hasNoPermission = () => false;
const submitNothing = async () => undefined;

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
});
