import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import {
  DashboardCoverageNotice,
  shouldShowDashboardCoverageNotice,
} from "./DashboardCoverageNotice";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/portal",
});

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
});

afterAll(() => dom.window.close());

function renderNotice(coverage) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  act(() => {
    root.render(<DashboardCoverageNotice coverage={coverage} />);
  });
  return container;
}

describe("shouldShowDashboardCoverageNotice", () => {
  test("hides when aggregate coverage is complete and ready", () => {
    expect(
      shouldShowDashboardCoverageNotice({
        complete: true,
        state: "ready",
      })
    ).toBe(false);
  });

  test("shows when aggregate coverage is still pending", () => {
    expect(
      shouldShowDashboardCoverageNotice({
        complete: false,
        state: "pending",
      })
    ).toBe(true);
  });

  test("shows when aggregate coverage is stale", () => {
    expect(
      shouldShowDashboardCoverageNotice({
        complete: true,
        state: "stale",
      })
    ).toBe(true);
  });
});

describe("DashboardCoverageNotice", () => {
  test("renders a persistent partial notice while coverage is pending", () => {
    const container = renderNotice({
      complete: false,
      lastCompletedAt: null,
      state: "pending",
    });

    const notice = container.querySelector('[data-testid="dashboard-coverage-notice"]');
    expect(notice).not.toBeNull();
    expect(notice?.getAttribute("role")).toBe("status");
    expect(notice?.textContent).toContain("still being prepared");
    expect(notice?.textContent).toContain("incomplete");
    expect(container.querySelector("button")).toBeNull();
    expect(notice?.textContent).not.toContain("error");
    expect(notice?.textContent).not.toContain("reconcil");
  });

  test("renders stale wording and last successful completion when present", () => {
    const container = renderNotice({
      complete: true,
      lastCompletedAt: "2026-07-10T14:30:00.000Z",
      state: "stale",
    });

    const notice = container.querySelector('[data-testid="dashboard-coverage-notice"]');
    expect(notice).not.toBeNull();
    expect(notice?.textContent).toContain("out of date");
    expect(notice?.textContent).toContain("Last fully updated");
    expect(notice?.textContent).toContain("10/07/2026");
    expect(container.querySelector("button")).toBeNull();
  });

  test("renders nothing when coverage is complete and fresh", () => {
    const container = renderNotice({
      complete: true,
      lastCompletedAt: "2026-07-14T10:00:00.000Z",
      state: "ready",
    });

    expect(container.querySelector('[data-testid="dashboard-coverage-notice"]')).toBeNull();
    expect(container.textContent).toBe("");
  });
});
