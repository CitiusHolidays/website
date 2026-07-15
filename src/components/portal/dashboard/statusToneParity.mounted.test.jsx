import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { StatusBadge } from "@/components/portal/workspace/portalWorkspaceListUi";
import { DashboardUpcomingDepartures } from "./DashboardWorkQueue";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/portal",
});

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
});

afterAll(() => dom.window.close());

describe("mounted status tone parity", () => {
  test("dashboard and list badges expose the same semantic tone and non-color meaning", () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    act(() => {
      root.render(
        <>
          <StatusBadge domain="dashboardReadiness" status="Docs pending" />
          <DashboardUpcomingDepartures
            departures={[
              {
                clientName: "Acme Group",
                id: "job-1",
                jobCode: "JC-0001-NS",
                pax: 12,
                readiness: "Docs pending",
                travelStartDate: "2026-07-20",
              },
            ]}
            hasJobCards
          />
        </>
      );
    });

    const badges = [...container.querySelectorAll('[data-status-tone="warning"]')];
    // One direct list badge plus the dashboard table's desktop and responsive-card copies.
    expect(badges).toHaveLength(3);
    expect(badges.map((badge) => badge.getAttribute("aria-label"))).toEqual([
      "Documents pending before departure",
      "Documents pending before departure",
      "Documents pending before departure",
    ]);

    act(() => root.unmount());
  });

  test("unknown imported states stay neutral and remain readable", () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    act(() => {
      root.render(<StatusBadge domain="visa" status="Legacy embassy state" />);
    });

    const badge = container.querySelector('[data-status-tone="neutral"]');
    expect(badge?.textContent).toBe("Legacy embassy state");
    expect(badge?.getAttribute("aria-label")).toBe("Status: Legacy embassy state");

    act(() => root.unmount());
  });
});
