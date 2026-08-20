import { describe, expect, test } from "bun:test";
import { existsSync, globSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

const ROOT = join(import.meta.dir, "../..");
const RAW_INSERT_PATTERN = /ctx\.db\.insert\(/;
const RAW_WRITE_PATTERN = /ctx\.db\.(?:insert|patch)\(/;
const OWNERSHIP_HELPER_PATTERN = /(?:insert|patch)WithE2eOwnership/;
const DERIVED_WRITE_PATTERN = /(?:storeCommandReceipt|scheduleCrmMetricSync)/;
const LOCAL_IMPORT_PATTERN = /from\s+["'](\.[^"']+)["']/g;
const FRONTEND_CRM_MUTATION_PATTERN =
  /use(?:Action|Mutation)\(api\.crm\.([A-Za-z0-9_]+)\.[A-Za-z0-9_]+\)/g;
const REVIEWED_NON_E2E_INSERT_OWNERS = [
  "convex/crm/commercialFilePurge.ts",
  "convex/crm/commercialFiles.ts",
  "convex/crm/flightImports.ts",
  "convex/crm/inboundQueryIntents.ts",
  "convex/crm/invoiceCommands.ts",
  "convex/crm/jobCardChecklistCommands.ts",
  "convex/crm/jobCardDeletion.ts",
  "convex/crm/jobCardTravelBatchCommands.ts",
  "convex/crm/lib/operationalControls.ts",
  "convex/crm/lib/presentation.ts",
  "convex/crm/listSearch.ts",
  "convex/crm/metricAggregates.ts",
  "convex/crm/metricDirty.ts",
  "convex/crm/metricProjection.ts",
  "convex/crm/notificationUnreadProjection.ts",
  "convex/crm/ops.ts",
  "convex/crm/pnrCommands.ts",
  "convex/crm/proposalAttachments.ts",
  "convex/crm/proposalLinkProjection.ts",
  "convex/crm/queryCommercialProjection.ts",
  "convex/crm/savedViews.ts",
  "convex/crm/seatCommands.ts",
  "convex/crm/settings.ts",
  "convex/crm/staff.ts",
  "convex/crm/visa.ts",
] as const;

function browserMutationRoots() {
  const roots = new Set<string>();
  for (const relativePath of globSync("src/**/*.{js,jsx,ts,tsx}", { cwd: ROOT })) {
    const source = readFileSync(join(ROOT, relativePath), "utf8");
    for (const match of source.matchAll(FRONTEND_CRM_MUTATION_PATTERN)) {
      const root = `convex/crm/${match[1]}.ts`;
      if (existsSync(join(ROOT, root))) {
        roots.add(root);
      }
    }
  }
  return [...roots];
}

function browserReachableCrmSources() {
  const pending = browserMutationRoots();
  const discovered = new Set<string>();
  while (pending.length > 0) {
    const relativePath = pending.pop();
    if (!relativePath || discovered.has(relativePath)) {
      continue;
    }
    discovered.add(relativePath);
    const absolutePath = join(ROOT, relativePath);
    const source = readFileSync(absolutePath, "utf8");
    for (const match of source.matchAll(LOCAL_IMPORT_PATTERN)) {
      const unresolved = resolve(dirname(absolutePath), match[1]);
      let resolved = join(unresolved, "index.ts");
      if (existsSync(unresolved) && statSync(unresolved).isFile()) {
        resolved = unresolved;
      } else if (existsSync(`${unresolved}.ts`)) {
        resolved = `${unresolved}.ts`;
      }
      const importedPath = relative(ROOT, resolved).split(sep).join("/");
      if (importedPath.startsWith("convex/crm/") && existsSync(resolved)) {
        pending.push(importedPath);
      }
    }
  }
  return [...discovered].sort();
}

describe("Durable E2E ownership contract", () => {
  test("Discovers browser-reachable mutation owners through imports", () => {
    const reachable = browserReachableCrmSources();
    const writeOwners = reachable.filter((relativePath) => {
      const source = readFileSync(join(ROOT, relativePath), "utf8");
      return RAW_INSERT_PATTERN.test(source) || OWNERSHIP_HELPER_PATTERN.test(source);
    });
    expect(writeOwners).toEqual(
      expect.arrayContaining([
        "convex/crm/commandReceipts.ts",
        "convex/crm/importProcessor.ts",
        "convex/crm/passengerImportOperations.ts",
        "convex/crm/passengerImportReceipts.ts",
        "convex/crm/proposalRelations.ts",
        "convex/crm/proposalWriteCommands.ts",
        "convex/crm/queryCreation.ts",
        "convex/crm/ticketCommands.ts",
      ])
    );
    const unownedInsertOwners = writeOwners.filter((relativePath) => {
      const source = readFileSync(join(ROOT, relativePath), "utf8");
      return relativePath !== "convex/crm/lib/e2eOwnership.ts" && RAW_INSERT_PATTERN.test(source);
    });
    expect(unownedInsertOwners).toEqual(REVIEWED_NON_E2E_INSERT_OWNERS);
  });

  test("Discovers command receipts and scheduled derivative writes outside a manual allowlist", () => {
    const browserMutationImports = browserReachableCrmSources().filter((relativePath) => {
      const source = readFileSync(join(ROOT, relativePath), "utf8");
      return DERIVED_WRITE_PATTERN.test(source);
    });
    expect(browserMutationImports).toEqual(
      expect.arrayContaining([
        "convex/crm/proposalHandoffCommands.ts",
        "convex/crm/queryCommands.ts",
        "convex/crm/ticketCommands.ts",
      ])
    );
    expect(readFileSync(join(ROOT, "convex/crm/commandReceipts.ts"), "utf8")).toContain(
      "insertWithE2eOwnership"
    );
    const metricSync = readFileSync(join(ROOT, "convex/crm/financeMetricSync.ts"), "utf8");
    expect(metricSync).toContain("await hasActiveE2eRun(ctx, actor)");
  });

  test("Uses reviewed table cleanup order and restores patched reusable fixtures", () => {
    const ownership = readFileSync(join(ROOT, "convex/crm/lib/e2eOwnership.ts"), "utf8");
    const cleanup = readFileSync(join(ROOT, "convex/crm/e2eRunOwnership.ts"), "utf8");
    expect(ownership).toContain("E2E_CLEANUP_TABLE_ORDER");
    expect(ownership).toContain("patchWithE2eOwnership");
    expect(ownership).toContain("passengerExportOperations: 90");
    expect(ownership).toContain("passengerExportSourceChunks: 100");
    expect(ownership).toContain("passengerImportOperationBatches: 110");
    expect(ownership).toContain("passengerImportOperations: 100");
    expect(ownership).toContain("notificationEmailEventOrigins: 100");
    expect(ownership).toContain("crmImportBatches: 105");
    expect(ownership).toContain("customerJourneyEntitlements: 100");
    expect(ownership).toContain("authIdentityLinks: 30");
    expect(ownership).toContain("userProfiles: 20");
    expect(ownership).toContain("sacredBharatLeaderboardSummaries: 90");
    expect(ownership).toContain("sacredBharatVisits: 100");
    expect(ownership).toContain("sacredBharatWishlist: 100");
    expect(ownership).toContain("recordPatchedStorageIds");
    expect(cleanup).toContain("by_runId_cleanupOrder_createdAt");
    expect(cleanup).toContain("ctx.db.replace");
    expect(cleanup).toContain("sacredBharatLeaderboardRanks.deleteIfExists");
    expect(cleanup).toContain("sacredBharatLeaderboardRanks.replaceOrInsert");
    expect(cleanup).not.toContain("record.tableName as TableNames");
  });

  test("Owns authenticated Sacred Bharat merge writes and aggregate cleanup", () => {
    const merge = readFileSync(join(ROOT, "convex/lib/sacredBharatGuestMerge.ts"), "utf8");
    const leaderboard = readFileSync(join(ROOT, "convex/lib/sacredBharatLeaderboard.ts"), "utf8");
    expect(merge).toContain('insertWithE2eOwnership(ctx, "sacredBharatVisits"');
    expect(merge).toContain('insertWithE2eOwnership(ctx, "sacredBharatWishlist"');
    expect(leaderboard).toContain('insertWithE2eOwnership(ctx, "sacredBharatLeaderboardSummaries"');
    expect(leaderboard).toContain('patchWithE2eOwnership(ctx, "sacredBharatLeaderboardSummaries"');
  });

  test("Threads action-owned passenger imports and exports through explicit actor ownership", () => {
    const processor = readFileSync(join(ROOT, "convex/crm/importProcessor.ts"), "utf8");
    const operations = readFileSync(join(ROOT, "convex/crm/passengerImportOperations.ts"), "utf8");
    const receipts = readFileSync(join(ROOT, "convex/crm/passengerImportReceipts.ts"), "utf8");
    for (const source of [processor, operations, receipts]) {
      expect(source).not.toMatch(RAW_WRITE_PATTERN);
      expect(source).toMatch(OWNERSHIP_HELPER_PATTERN);
      expect(source).toContain("authUserId");
    }
    const exportOperations = readFileSync(
      join(ROOT, "convex/crm/passengerExportOperations.ts"),
      "utf8"
    );
    expect(exportOperations).toContain("insertWithE2eOwnership");
    expect(exportOperations).toContain("{ authUserId: args.access.authUserId }");
    expect(
      exportOperations.match(/authUserId: operation\.initiatedBy/g)?.length
    ).toBeGreaterThanOrEqual(3);
  });

  test("Registers fail-closed setup, teardown, and interrupted-run cleanup", () => {
    const setup = readFileSync(join(ROOT, "e2e/global-setup.ts"), "utf8");
    const teardown = readFileSync(join(ROOT, "e2e/global-teardown.ts"), "utf8");
    const ownership = readFileSync(join(ROOT, "convex/crm/e2eRunOwnership.ts"), "utf8");
    const notifications = readFileSync(join(ROOT, "convex/crm/lib/notifications.ts"), "utf8");
    const http = readFileSync(join(ROOT, "convex/http.ts"), "utf8");
    const seed = readFileSync(join(ROOT, "e2e/helpers/seed.ts"), "utf8");
    const packageJson = readFileSync(join(ROOT, "package.json"), "utf8");
    expect(setup).toContain("randomUUID()");
    expect(setup).toContain("verifyConvexE2eIdentity(approvedTarget)");
    expect(setup).toContain("cleanupE2eRun(runId, approvedTarget)");
    expect(setup).toContain('join(AUTH_DIR, "customer.json")');
    expect(teardown).toContain("verifyConvexE2eIdentity(approvedTarget)");
    expect(teardown).toContain("residualCount !== 0");
    expect(http).toContain('path: "/e2e/identity"');
    expect(http).toContain('request.headers.get("x-e2e-target-id")');
    expect(http).toContain('request.headers.get("x-e2e-seed-secret")');
    expect(seed).toContain("approved.convexSiteOrigin");
    expect(seed).toContain("targetId: approved.id");
    expect(ownership).toContain("assertE2eTargetIdentity(args.targetId)");
    expect(notifications).toContain("await hasActiveE2eRun(ctx)");
    expect(packageJson).toContain('"test:e2e:cleanup"');
  });
});
