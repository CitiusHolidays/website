import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { DashboardHero } from "./DashboardHero";

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

describe("DashboardHero", () => {
  test("groups assigned queues with hierarchy and lightweight dividers", () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    act(() => {
      root.render(
        <DashboardHero
          dateRange={{ from: "2026-08-01", to: "2026-08-31" }}
          displayName="Nishit"
          generatedAt={null}
          ownedWorkSla={{
            items: [
              {
                count: 2,
                href: "/portal/queries?status=Submitted",
                label: "Sales follow-ups",
                oldestDays: 3,
              },
              {
                count: 1,
                href: "/portal/proposals?status=Draft",
                label: "Draft proposals",
                oldestDays: 1,
              },
            ],
          }}
          showSlaStrip
        />
      );
    });

    expect(container.textContent).toContain("Assigned work");
    expect(container.textContent).toContain("Oldest open item by queue");
    expect(container.textContent).toContain("Oldest: 3 days");
    expect(container.textContent).toContain("Oldest: 1 day");
    expect(container.textContent).not.toContain("Owned-work SLA");

    const links = [...container.querySelectorAll("a")];
    expect(links).toHaveLength(2);
    expect(links.every((link) => link.className.includes("border-s"))).toBe(true);
    expect(links[0]?.href).toContain("from=2026-08-01");
    expect(links[0]?.href).toContain("to=2026-08-31");
    expect(container.textContent).toContain("2 items");
    expect(container.textContent).toContain("1 item");

    act(() => root.unmount());
  });
});
