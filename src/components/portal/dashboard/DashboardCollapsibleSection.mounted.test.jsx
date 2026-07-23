import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { DashboardCollapsibleSection } from "./DashboardCollapsibleSection";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/portal",
});

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  globalThis.localStorage = {
    getItem: (key) => dom.window.localStorage.getItem(key),
    setItem: (key, value) => dom.window.localStorage.setItem(key, value),
  };
});

afterAll(() => dom.window.close());

describe("mounted dashboard collapsible section", () => {
  test("persists workflow collapse preference in localStorage", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () =>
      root.render(
        <DashboardCollapsibleSection
          departmentWorkflow={[{ label: "Sales", percent: 40, value: 4 }]}
          myTeam={[]}
          showTeam={false}
          showWorkflow
        />
      )
    );

    const toggle = container.querySelector('button[aria-expanded="true"]');
    expect(toggle).not.toBeNull();
    await act(async () => toggle?.click());
    expect(dom.window.localStorage.getItem("portal-dashboard-collapse-workflow")).toBe("0");

    await act(async () => root.unmount());
    container.remove();
  });
});
