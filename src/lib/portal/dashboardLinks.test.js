import { describe, expect, test } from "bun:test";
import {
  buildDashboardListUrl,
  buildKpiHref,
  buildQueryTypeTileHref,
  buildUrgentActionHref,
  buildUrgentViewAllHref,
} from "./dashboardLinks.js";

function parsed(url) {
  return new URL(url, "https://portal.test");
}

describe("dashboardLinks", () => {
  test("builds KPI hrefs with date range and list filter params", () => {
    const url = parsed(
      buildKpiHref("Proposals Sent", {
        from: "2026-01-01",
        to: "2026-01-31",
      }),
    );

    expect(url.pathname).toBe("/portal/proposals");
    expect(url.searchParams.get("from")).toBe("2026-01-01");
    expect(url.searchParams.get("to")).toBe("2026-01-31");
    expect(url.searchParams.get("f_status")).toBe("Sent");
  });

  test("builds dashboard list urls with filters and deep-link params", () => {
    const url = parsed(
      buildDashboardListUrl({
        view: "accounts-job-cards",
        listFilters: { status: "Open" },
        deepLink: { open: "jobCard", queryId: "query_1" },
      }),
    );

    expect(url.pathname).toBe("/portal/accounts/job-cards");
    expect(url.searchParams.get("f_status")).toBe("Open");
    expect(url.searchParams.get("open")).toBe("jobCard");
    expect(url.searchParams.get("queryId")).toBe("query_1");
  });

  test("prefers server-built urgent action hrefs", () => {
    expect(
      buildUrgentActionHref({
        id: "invoice_1",
        type: "finance",
        entityType: "invoice",
        entityId: "invoice_1",
        href: "/portal/finance",
      }),
    ).toBe("/portal/finance");
  });

  test("falls back to notification-style urgent action links", () => {
    expect(
      buildUrgentActionHref({
        id: "query_1",
        type: "accounts",
        entityType: "query",
        entityId: "query_1",
      }),
    ).toBe("/portal/accounts/job-cards?open=jobCard&queryId=query_1");
  });

  test("builds query type tile hrefs with bucket filters", () => {
    const url = parsed(buildQueryTypeTileHref("closed", "MICE"));

    expect(url.pathname).toBe("/portal/queries");
    expect(url.searchParams.get("f_queryType")).toBe("MICE");
    expect(url.searchParams.get("f_salesStatus")).toBe("Order Lost");
  });

  test("builds view-all hrefs for urgent action groups", () => {
    const url = parsed(buildUrgentViewAllHref("ticketing"));

    expect(url.pathname).toBe("/portal/tickets");
    expect(url.searchParams.get("f_ticketStatus")).toBe("Name Change Required");
  });
});
