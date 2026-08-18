import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import QueriesLoading from "@/app/portal/queries/loading";
import QueriesLoadingPanel from "./QueriesLoadingPanel";

const dom = new JSDOM("<!doctype html><html><body></body></html>");

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
});

afterAll(() => dom.window.close());

describe("QueriesLoadingPanel", () => {
  test("Is mounted by the route loading boundary", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    await act(async () => root.render(<QueriesLoading />));

    expect(container.querySelector('[data-testid="queries-loading-panel"]')).not.toBeNull();

    await act(async () => root.unmount());
  });

  test("Keeps the query list geometry visible while the route loads", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    await act(async () => root.render(<QueriesLoadingPanel />));

    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      "Loading All Sales Queries"
    );
    expect(container.querySelector('[data-testid="queries-loading-toolbar"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="queries-loading-table"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="queries-loading-cards"]')).not.toBeNull();
    expect(container.textContent).not.toContain("Q-");
    expect(container.textContent).not.toContain("No queries yet");

    await act(async () => root.unmount());
  });
});
