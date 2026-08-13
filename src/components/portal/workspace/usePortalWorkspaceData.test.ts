import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const DATA_HOOK_FILE = "src/components/portal/workspace/usePortalWorkspaceData.ts";

function read(file: string) {
  return readFileSync(file, "utf8");
}

describe("usePortalWorkspaceData subscription gates", () => {
  test("loads search readiness only for supported non-empty search", () => {
    const source = read(DATA_HOOK_FILE);

    expect(source).toContain("shouldLoadSearchReadiness");
    expect(source).toContain("isSearchableListView");
    expect(source).toMatch(
      /shouldLoadSearchReadiness\s*\?\s*\{\s*referenceNow:\s*navigationReferenceNow\s*\}\s*:\s*"skip"/
    );
    expect(source).not.toMatch(
      /useQuery\(\s*api\.crm\.listSearch\.getReadiness,\s*canFetch\s*\?\s*\{\s*referenceNow/
    );
  });

  test("loads extended notification history only when activity dependency is active", () => {
    const source = read(DATA_HOOK_FILE);

    expect(source).toMatch(
      /canFetch\s*&&\s*needs\("activity"\)\s*&&\s*has\(P\.VIEW_ACTIVITY\)\s*\?\s*\{\s*limit:\s*80\s*\}\s*:\s*"skip"/
    );
    expect(source).not.toMatch(
      /useQuery\(\s*api\.crm\.activity\.listNotifications,\s*canFetch\s*\?\s*\{\s*limit:\s*80/
    );
  });

  test("keeps portal chrome notification subscriptions in PortalShell", () => {
    const shell = read("src/components/portal/PortalShell.tsx");

    expect(shell).toMatch(
      /api\.crm\.activity\.notificationBellState,\s*isAuthenticated && access\.allowed \? \{ limit: 8 \}/
    );
    expect(shell).not.toContain("api.crm.activity.notificationSummary");
    expect(shell).not.toContain("api.crm.activity.listNotifications");
  });

  test("loads focused query detail while creating a job card", () => {
    const source = read(DATA_HOOK_FILE);

    expect(source).toContain(
      '(modal === "jobCard" && !form.entityId ? String(form.queryId || "") : null)'
    );
  });

  test("owns time inputs at the narrow active surface", () => {
    const source = read(DATA_HOOK_FILE);

    expect(source).toContain(
      "passengerImportModalActive || passengerExportModalActive || jobCardDeletionClockActive"
    );
    expect(source).toContain(
      'passengerImportModalActive ? { referenceNow: operationReferenceNow } : "skip"'
    );
    expect(source).toContain(
      'passengerExportModalActive ? { referenceNow: operationReferenceNow } : "skip"'
    );
    expect(source).toContain("{ dateRange: dateRangeArg, referenceNow: navigationReferenceNow }");
    expect(source).toContain('? { referenceNow: operationReferenceNow } : "skip"');
    expect(source).toContain("? { dateRange: dateRangeArg, referenceDate }");
    expect(source).toContain("referenceDate,");
  });
});
