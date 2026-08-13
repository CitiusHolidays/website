import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { getMyJourneyDetail, getMyJourneySummaries } from "../bookings";
import { handleListFinanceOutstanding } from "./financeOverviewReads";
import { listMyDeletionOperations } from "./jobCards";
import { balances } from "./leave";
import { listMyPassengerExportOperationsHandler } from "./passengerExportOperations";
import { listMyPassengerImportOperationsHandler } from "./passengerImportOperations";
import { handleDashboard } from "./ticketingDashboardReads";

const zeroArgumentClock = /Date\.now\(\)|new Date\(\s*\)/;

describe("public query time ownership", () => {
  test("keeps every affected handler deterministic from required caller inputs", () => {
    const handlers = [
      (getMyJourneySummaries as any)._handler,
      (getMyJourneyDetail as any)._handler,
      (balances as any)._handler,
      (listMyDeletionOperations as any)._handler,
      listMyPassengerImportOperationsHandler,
      listMyPassengerExportOperationsHandler,
      handleDashboard,
      handleListFinanceOutstanding,
    ];

    for (const handler of handlers) {
      expect(String(handler)).not.toMatch(zeroArgumentClock);
    }
  });

  test("makes all public time/date arguments required at their validators", () => {
    const files = [
      readFileSync(new URL("../bookings.ts", import.meta.url), "utf8"),
      readFileSync(new URL("./finance.ts", import.meta.url), "utf8"),
      readFileSync(new URL("./imports.ts", import.meta.url), "utf8"),
      readFileSync(new URL("./jobCards.ts", import.meta.url), "utf8"),
      readFileSync(new URL("./leave.ts", import.meta.url), "utf8"),
      readFileSync(new URL("./ticketing.ts", import.meta.url), "utf8"),
    ].join("\n");

    expect(files).not.toContain("referenceNow: v.optional(v.number())");
    expect(files).toContain("referenceDate: v.string()");
  });
});
