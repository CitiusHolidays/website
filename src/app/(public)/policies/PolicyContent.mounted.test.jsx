import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import PolicyContent from "./page.client";

const REVIEW_MARKER_TEXT = /^\[To confirm: .+\]$/;

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/policies?view=privacy",
});

let root;
let container;

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
});

afterAll(() => dom.window.close());

function renderView(activeView) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => root.render(<PolicyContent activeView={activeView} />));
  return container;
}

function tab(label) {
  return [...container.querySelectorAll('nav[aria-label="Policy documents"] a')].find(
    (link) => link.textContent === label
  );
}

describe("Policy documents", () => {
  test("Privacy view renders the draft notice, highlighted review markers and current tab", () => {
    renderView("privacy");

    expect(container.querySelector("h2")?.textContent).toBe("Privacy Policy");
    expect(container.querySelector('[role="note"]')?.textContent).toContain(
      "Draft for legal and management review"
    );
    const markers = container.querySelectorAll("mark[data-review-marker]");
    expect(markers.length).toBe(12);
    for (const marker of markers) {
      expect(marker.textContent).toMatch(REVIEW_MARKER_TEXT);
    }
    expect(tab("Privacy Policy")?.getAttribute("aria-current")).toBe("page");
    expect(tab("Privacy Policy")?.getAttribute("href")).toBe("/policies?view=privacy");
    expect(tab("Terms & Conditions")?.getAttribute("aria-current")).toBeNull();
    expect(
      container.querySelector('a[href="/account?tab=settings#delete-account"]')
    ).not.toBeNull();
  });

  test("Terms and Billing link their Privacy Policy references to the privacy view", () => {
    for (const view of ["terms", "billing"]) {
      renderView(view);
      const documentLinks = [
        ...container.querySelectorAll('#policy-document a[href="/policies?view=privacy"]'),
      ];
      expect(documentLinks.map((link) => link.textContent)).toEqual(["Privacy Policy"]);
      expect(container.querySelectorAll("mark[data-review-marker]")).toHaveLength(0);
      act(() => root.unmount());
      container.remove();
      root = undefined;
    }
  });
});
