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
    dom.window.localStorage.clear();
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
    const panel = container.querySelector(`#${toggle?.getAttribute("aria-controls")}`);
    expect(panel?.hidden).toBe(false);
    await act(async () => toggle?.click());
    expect(dom.window.localStorage.getItem("portal-dashboard-collapse-workflow")).toBe("0");
    expect(toggle?.getAttribute("aria-expanded")).toBe("false");
    expect(panel?.hidden).toBe(true);
    expect(panel?.getAttribute("aria-hidden")).toBe("true");
    expect(panel?.querySelector("[tabindex],button,a,input,select,textarea")).toBeNull();

    await act(async () => root.unmount());
    container.remove();
  });

  test("restores a saved collapse preference after the first render", async () => {
    dom.window.localStorage.setItem("portal-dashboard-collapse-workflow", "0");
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

    const toggle = container.querySelector('button[aria-expanded="false"]');
    expect(toggle).not.toBeNull();
    const panel = container.querySelector(`#${toggle?.getAttribute("aria-controls")}`);
    expect(panel?.hidden).toBe(true);
    expect(panel?.getAttribute("aria-hidden")).toBe("true");
    await act(async () => root.unmount());
    container.remove();
  });
});
