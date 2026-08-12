import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "../..");
const RAW_WRITE_PATTERN = /ctx\.db\.(?:insert|patch)\(/;
const OWNERSHIP_HELPER_PATTERN = /(?:insert|patch)WithE2eOwnership/;
const BROWSER_MUTATION_MODULE_PATTERN = /(?:queryCommands|proposals|ticketCommands)/;
const DERIVED_WRITE_PATTERN = /(?:storeCommandReceipt|scheduleCrmMetricSync)/;
const MUTATING_INSERT_OWNERS = [
  "convex/crm/activity.ts",
  "convex/crm/commandReceipts.ts",
  "convex/crm/confirmedOffer.ts",
  "convex/crm/expenseApprovalWorkflow.ts",
  "convex/crm/expenseCommands.ts",
  "convex/crm/jobCardChecklist.ts",
  "convex/crm/jobCardCommands.ts",
  "convex/crm/jobCardCreation.ts",
  "convex/crm/leave.ts",
  "convex/crm/lib/activity.ts",
  "convex/crm/lib/notifications.ts",
  "convex/crm/proposals.ts",
  "convex/crm/queryAttachments.ts",
  "convex/crm/queryCreation.ts",
  "convex/crm/queryTeamAssignment.ts",
  "convex/crm/ticketCommands.ts",
  "convex/crm/travellers.ts",
] as const;

function crmSourceFiles() {
  return readdirSync(join(ROOT, "convex/crm"), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".ts") && !entry.name.includes("test"))
    .map((entry) => `convex/crm/${entry.name}`);
}

describe("durable E2E ownership contract", () => {
  test("routes every current mutating browser workflow insert through the ownership ledger", () => {
    for (const relativePath of MUTATING_INSERT_OWNERS) {
      const source = readFileSync(join(ROOT, relativePath), "utf8");
      expect(source).toMatch(OWNERSHIP_HELPER_PATTERN);
      expect(source).not.toMatch(RAW_WRITE_PATTERN);
    }
  });

  test("discovers command receipts and scheduled derivative writes outside a manual allowlist", () => {
    const browserMutationImports = crmSourceFiles().filter((relativePath) => {
      const source = readFileSync(join(ROOT, relativePath), "utf8");
      return (
        BROWSER_MUTATION_MODULE_PATTERN.test(relativePath) && DERIVED_WRITE_PATTERN.test(source)
      );
    });
    expect(browserMutationImports).toEqual(
      expect.arrayContaining([
        "convex/crm/proposals.ts",
        "convex/crm/queryCommands.ts",
        "convex/crm/ticketCommands.ts",
      ])
    );
    expect(readFileSync(join(ROOT, "convex/crm/commandReceipts.ts"), "utf8")).toContain(
      "insertWithE2eOwnership"
    );
    const metricSync = readFileSync(join(ROOT, "convex/crm/financeMetricSync.ts"), "utf8");
    expect(metricSync).toContain("await hasActiveE2eRun(ctx)");
  });

  test("uses reviewed table cleanup order and restores patched reusable fixtures", () => {
    const ownership = readFileSync(join(ROOT, "convex/crm/lib/e2eOwnership.ts"), "utf8");
    const cleanup = readFileSync(join(ROOT, "convex/crm/e2eRunOwnership.ts"), "utf8");
    expect(ownership).toContain("E2E_CLEANUP_TABLE_ORDER");
    expect(ownership).toContain("patchWithE2eOwnership");
    expect(cleanup).toContain("by_runId_cleanupOrder_createdAt");
    expect(cleanup).toContain("ctx.db.replace");
    expect(cleanup).not.toContain("record.tableName as TableNames");
  });

  test("registers fail-closed setup, teardown, and interrupted-run cleanup", () => {
    const setup = readFileSync(join(ROOT, "e2e/global-setup.ts"), "utf8");
    const teardown = readFileSync(join(ROOT, "e2e/global-teardown.ts"), "utf8");
    const ownership = readFileSync(join(ROOT, "convex/crm/e2eRunOwnership.ts"), "utf8");
    const notifications = readFileSync(join(ROOT, "convex/crm/lib/notifications.ts"), "utf8");
    const packageJson = readFileSync(join(ROOT, "package.json"), "utf8");
    expect(setup).toContain("randomUUID()");
    expect(setup).toContain("cleanupE2eRun(runId, approvedTarget.id)");
    expect(teardown).toContain("residualCount !== 0");
    expect(ownership).toContain("assertE2eTargetIdentity(args.targetId)");
    expect(notifications).toContain("await hasActiveE2eRun(ctx)");
    expect(packageJson).toContain('"test:e2e:cleanup"');
  });
});
