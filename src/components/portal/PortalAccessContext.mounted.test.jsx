import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { PortalAccessProvider, usePortalServerAccess } from "./PortalAccessContext";

const dom = new JSDOM("<!doctype html><html><body></body></html>");

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
});

afterAll(() => dom.window.close());

function AccessProbe() {
  const access = usePortalServerAccess();
  return <output>{access?.allowed ? access.roles?.join(",") : "loading"}</output>;
}

describe("PortalAccessProvider", () => {
  test("Hydrates descendants from server-resolved access before a live query arrives", () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    act(() => {
      root.render(
        <PortalAccessProvider access={{ allowed: true, roles: ["Sales"] }}>
          <AccessProbe />
        </PortalAccessProvider>
      );
    });

    expect(container.textContent).toBe("Sales");
    act(() => root.unmount());
  });
});
