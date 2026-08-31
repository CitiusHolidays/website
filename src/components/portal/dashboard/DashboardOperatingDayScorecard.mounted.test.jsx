import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import {
  canLoadOperatingDayScorecard,
  OperatingDayScorecardView,
} from "./DashboardOperatingDayScorecard";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  pretendToBeVisual: true,
  url: "https://citiusholidays.com/portal",
});

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.Element = dom.window.Element;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  globalThis.Event = dom.window.Event;
  globalThis.MutationObserver = dom.window.MutationObserver;
  globalThis.getComputedStyle = dom.window.getComputedStyle;
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  globalThis.cancelAnimationFrame = (frame) => clearTimeout(frame);
  dom.window.requestAnimationFrame = globalThis.requestAnimationFrame;
  dom.window.cancelAnimationFrame = globalThis.cancelAnimationFrame;
  dom.window.matchMedia = () => ({
    addEventListener() {
      // The fixture holds one stable motion preference.
    },
    matches: false,
    removeEventListener() {
      // Cleanup mirrors the inert fixture subscription.
    },
  });
  globalThis.matchMedia = dom.window.matchMedia;
});

afterEach(() => document.body.replaceChildren());
afterAll(() => dom.window.close());

async function mount(element) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(element));
  return { container, root };
}

function metric(overrides = {}) {
  return {
    breakdown: [],
    cohort: {
      definition: "Exact source-bound completed records in the selected cohort.",
      from: "2026-08-30",
      timeZone: "UTC",
      to: "2026-08-30",
    },
    coverage: {
      included: 1,
      limit: 120,
      missingClocks: 0,
      pending: 0,
      state: "complete",
      total: 1,
      unresolvedRecords: 0,
    },
    drillDown: {
      rows: [
        {
          at: "2026-08-30T11:00:00.000Z",
          durationMs: null,
          href: "/portal/queries?open=query&id=safe-query-id",
          label: "Website enquiry",
          status: "Confirmed Offer",
        },
      ],
      total: 1,
      truncated: false,
    },
    id: "inbound_confirmed",
    label: "Confirmed from consented enquiries",
    lastCompleteAt: "2026-08-30T16:00:00.000Z",
    readiness: "ready",
    unit: "count",
    value: { count: 1, medianMs: null, p90Ms: null, status: "Known" },
    ...overrides,
  };
}

function scorecard() {
  return {
    generatedAt: "2026-08-30T16:00:00.000Z",
    metrics: [
      metric(),
      metric({
        cohort: {
          definition: "Completed clocks only; legacy gaps are never estimated.",
          from: "2026-08-30",
          timeZone: "UTC",
          to: "2026-08-30",
        },
        coverage: {
          included: 0,
          limit: 120,
          missingClocks: 1,
          pending: 0,
          state: "partial",
          total: 2,
          unresolvedRecords: 1,
        },
        drillDown: { rows: [], total: 0, truncated: false },
        id: "inbound_to_query",
        label: "Enquiry received to Query",
        lastCompleteAt: null,
        readiness: "partial",
        unit: "milliseconds",
        value: { count: null, medianMs: null, p90Ms: null, status: "Unknown" },
      }),
      metric({
        cohort: {
          definition: "Setup required before this organization-wide clock can be computed.",
          from: "2026-08-30",
          timeZone: "UTC",
          to: "2026-08-30",
        },
        coverage: {
          included: 0,
          limit: 120,
          missingClocks: 0,
          pending: 0,
          state: "partial",
          total: 0,
          unresolvedRecords: 0,
        },
        drillDown: { rows: [], total: 0, truncated: false },
        id: "handoff_to_decision",
        label: "Proposal Handoff to Sales Decision",
        lastCompleteAt: null,
        readiness: "setup_required",
        unit: "milliseconds",
        value: { count: null, medianMs: null, p90Ms: null, status: "Unknown" },
      }),
    ],
    scope: { kind: "role", roles: ["Sales", "Sales Head"] },
    window: {
      from: "2026-08-30",
      maxDays: 31,
      status: "bounded",
      timeZone: "UTC",
      to: "2026-08-30",
    },
  };
}

describe("Operating-day scorecard Staff view", () => {
  test("shows cohort, coverage, readiness, freshness, Unknown, and exact safe drill-down", async () => {
    const view = await mount(<OperatingDayScorecardView scorecard={scorecard()} />);
    const text = view.container.textContent;
    expect(text).toContain("Operating-day scorecard");
    expect(text).toContain("Role scope · Sales, Sales Head");
    expect(text).toContain("Confirmed from consented enquiries");
    expect(text).toContain("1/1 usable · 0 missing clocks · 0 unresolved · 0 pending");
    expect(text).toContain("2026-08-30 16:00 UTC");
    expect(text).toContain("Enquiry received to Query");
    expect(text).toContain("Unknown");
    expect(text).toContain("0/2 usable · 1 missing clocks · 1 unresolved · 0 pending");
    expect(text).toContain("Drill-down is withheld until this cohort is complete.");
    expect(text).toContain("setup required");
    const exactLink = view.container.querySelector(
      'a[href="/portal/queries?open=query&id=safe-query-id"]'
    );
    expect(exactLink?.textContent).toContain("Website enquiry");
    expect(text).not.toContain("raw-pii-must-not-leave-scorecard");
    await act(async () => view.root.unmount());
  });

  test("loads only for a stable Staff identity in an existing owner role", () => {
    expect(canLoadOperatingDayScorecard({ roles: ["Admin"] })).toBe(false);
    expect(canLoadOperatingDayScorecard({ roles: ["Sales"], staffId: "staff-1" })).toBe(false);
    expect(canLoadOperatingDayScorecard({ roles: ["Directors"], staffId: "staff-1" })).toBe(true);
    expect(canLoadOperatingDayScorecard({ roles: ["Contracting Head"], staffId: "staff-1" })).toBe(
      true
    );
  });
});
