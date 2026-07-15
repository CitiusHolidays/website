import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { DashboardUpcomingDepartures } from "@/components/portal/dashboard/DashboardWorkQueue";
import { StatusBadge } from "@/components/portal/workspace/portalWorkspaceListUi";
import { getStatusPresentation } from "@/lib/portal/statusTones";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/portal",
});

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  globalThis.Event = dom.window.Event;
  globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
});

afterAll(() => dom.window.close());

async function mount(element) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(element));
  return {
    container,
    unmount: async () => {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

function badgeMeaning(container) {
  return container.querySelector('[role="status"]')?.getAttribute("aria-label") ?? "";
}

describe("mounted status tone parity", () => {
  test("dashboard readiness and job card badges expose their domain meaning", async () => {
    const readiness = "Docs pending";
    const expected = getStatusPresentation("dashboardReadiness", readiness);

    const dashboard = await mount(
      <DashboardUpcomingDepartures
        dateRange={{ from: "", to: "" }}
        departures={[
          {
            clientName: "Acme Tours",
            id: "job-1",
            jobCode: "JC-0001-NS",
            pax: 12,
            readiness,
            tourManagerName: "Priya",
            travelStartDate: "2026-08-01",
          },
        ]}
        hasJobCards
      />
    );
    expect(dashboard.container.textContent).toContain(readiness);
    expect(badgeMeaning(dashboard.container)).toBe(expected.meaning);
    await dashboard.unmount();

    const list = await mount(<StatusBadge domain="jobCard" status="Open" />);
    const jobCardExpected = getStatusPresentation("jobCard", "Open");
    expect(badgeMeaning(list.container)).toBe(jobCardExpected.meaning);
    await list.unmount();
  });

  test("With Sales and Order Confirmed expose accessible badge meaning", async () => {
    expect(getStatusPresentation("proposal", "Sent").meaning).toBe(
      "With Sales — awaiting Sales Decision"
    );
    expect(getStatusPresentation("querySales", "Order Confirmed").semanticTone).toBe("positive");
    expect(getStatusPresentation("querySales", "Order Lost").semanticTone).toBe("danger");
  });
});
