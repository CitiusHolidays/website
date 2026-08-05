import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import PortalLoadingShell from "./PortalLoadingShell";

const dom = new JSDOM("<!doctype html><html><body></body></html>");

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
});

afterAll(() => dom.window.close());

describe("PortalLoadingShell", () => {
  test("shows a stable non-sensitive loading surface", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    await act(async () => root.render(<PortalLoadingShell />));

    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(container.querySelector("#portal-main")).not.toBeNull();
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      "Loading Citius Connect portal"
    );
    expect(container.textContent).not.toContain("All Sales Queries");
    expect(container.textContent).not.toContain("Sales User");

    await act(async () => root.unmount());
  });
});
