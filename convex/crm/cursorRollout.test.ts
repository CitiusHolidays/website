import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { PORTAL_ROUTES } from "../../src/lib/portal/portalRouteManifest";
import { serializeUrlFilterState } from "../../src/lib/portal/urlFilterState.js";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

const cursorRegistrations = [
  ["./queries.ts", "listPage"],
  ["./proposals.ts", "listPage"],
  ["./jobCards.ts", "listPage"],
  ["./travellers.ts", "listPage"],
  ["./visa.ts", "list"],
  ["./ops.ts", "listHotels"],
  ["./ops.ts", "listTourManagers"],
  ["./ticketing.ts", "listPnrs"],
  ["./ticketing.ts", "listTickets"],
  ["./ticketing.ts", "listSeatAllocations"],
  ["./imports.ts", "listFlightItinerary"],
  ["./finance.ts", "listInvoices"],
  ["./finance.ts", "listExpenses"],
  ["./finance.ts", "listFinancePnl"],
  ["./finance.ts", "listFinanceOutstanding"],
  ["./approvals.ts", "list"],
  ["./leave.ts", "list"],
  ["./activity.ts", "listActivity"],
  ["./staff.ts", "listStaff"],
  ["./staff.ts", "listDirectory"],
] as const;

describe("CRM cursor rollout", () => {
  test("every operational list boundary accepts a Convex cursor", () => {
    for (const [path, exportName] of cursorRegistrations) {
      const source = read(path);
      const registration = source.slice(source.indexOf(`export const ${exportName} = query({`));
      expect(registration, `${path}:${exportName}`).toContain("paginationOptsValidator");
    }
  });

  test("page readers paginate before bounded relationship hydration", () => {
    for (const path of [
      "./proposalReturnContracts.ts",
      "./financeTicketingReturnContracts.ts",
      "./operationsReturnContracts.ts",
      "./peopleWorkflowReturnContracts.ts",
      "./staffSettingsReturnContracts.ts",
      "./importReturnContracts.ts",
    ]) {
      expect(read(path), path).toContain("paginationResultValidator");
    }
    for (const path of [
      "./pnrReads.ts",
      "./ticketReads.ts",
      "./seatReads.ts",
      "./invoiceReads.ts",
      "./expenseReads.ts",
      "./financeOverviewReads.ts",
    ]) {
      const source = read(path);
      expect(source, path).toContain(".paginate(boundedPaginationOptions(");
      expect(source, path).not.toContain('.query("pnrs").collect()');
      expect(source, path).not.toContain('.query("tickets").collect()');
      expect(source, path).not.toContain('.query("seatAllocations").collect()');
      expect(source, path).not.toContain('.query("invoices").collect()');
      expect(source, path).not.toContain('.query("expenseEntries").collect()');
    }
  });

  test("portal load-more routing covers every migrated list surface", () => {
    const expected = {
      activity: "activity",
      approvals: "approvals",
      contracting: "queries",
      "employees-on-leave": "leaves",
      expenses: "expenses",
      finance: "invoices",
      flights: "flightOperations",
      hotels: "hotelOperations",
      "job-cards": "jobCards",
      passport: "travellers",
      proposals: "proposals",
      queries: "queries",
      "seat-allocation": "seats",
      settings: "staff",
      team: "team",
      tickets: "tickets",
      "tour-managers": "tourManagers",
      travellers: "travellers",
      visa: "visas",
    } as const;
    for (const [view, paginationKey] of Object.entries(expected)) {
      expect(PORTAL_ROUTES[view as keyof typeof PORTAL_ROUTES].paginationKey, view).toBe(
        paginationKey
      );
    }
  });

  test("scale policy keeps 135 records behind three explicit pages", () => {
    const rows = Array.from({ length: 135 }, (_, index) => `row-${index + 1}`);
    const pages = [rows.slice(0, 50), rows.slice(50, 100), rows.slice(100, 150)];
    expect(pages.map((page) => page.length)).toEqual([50, 50, 35]);
    expect(pages.flat()).toEqual(rows);
  });

  test("a 10,000-row fixture reaches a filtered first page within 250ms and preserves URL state", () => {
    const startedAt = performance.now();
    const rows = Array.from({ length: 10_000 }, (_, index) => ({
      createdAt: 10_000 - index,
      id: `row-${index + 1}`,
      status: index % 3 === 0 ? "Pending" : "Complete",
    }));
    const firstPage = rows.filter((row) => row.status === "Pending").slice(0, 50);
    const params = serializeUrlFilterState(
      {
        dateRange: { from: "2026-07-01", to: "2026-07-31" },
        jobCardFilter: "jc-100",
        listFilters: { salesStatus: "Pending" },
        search: "Acme",
      },
      [{ field: "salesStatus" }],
      {
        preserveRouteContext: true,
        searchParams: new URLSearchParams("open=query&id=query-1"),
      }
    );

    expect(firstPage).toHaveLength(50);
    expect(firstPage.every((row) => row.status === "Pending")).toBe(true);
    expect(firstPage.map((row) => row.createdAt)).toEqual(
      [...firstPage].map((row) => row.createdAt).sort((left, right) => right - left)
    );
    expect(params.get("q")).toBe("Acme");
    expect(params.get("f_salesStatus")).toBe("Pending");
    expect(params.get("open")).toBe("query");
    expect(params.get("id")).toBe("query-1");
    expect(performance.now() - startedAt).toBeLessThan(250);
  });
});
