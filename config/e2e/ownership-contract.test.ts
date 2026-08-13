import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

const ROOT = join(import.meta.dir, "../..");
const RAW_WRITE_PATTERN = /ctx\.db\.(?:insert|patch)\(/;
const OWNERSHIP_HELPER_PATTERN = /(?:insert|patch)WithE2eOwnership/;
const DERIVED_WRITE_PATTERN = /(?:storeCommandReceipt|scheduleCrmMetricSync)/;
const LOCAL_IMPORT_PATTERN = /from\s+["'](\.[^"']+)["']/g;
const BROWSER_MUTATION_ROOTS = [
  "convex/crm/proposals.ts",
  "convex/crm/queryCommands.ts",
  "convex/crm/ticketCommands.ts",
] as const;

function browserReachableCrmSources() {
  const pending = [...BROWSER_MUTATION_ROOTS];
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

describe("durable E2E ownership contract", () => {
  test("discovers browser-reachable mutation owners through imports", () => {
    const reachable = browserReachableCrmSources();
    const ownershipOwners = reachable.filter((relativePath) =>
      OWNERSHIP_HELPER_PATTERN.test(readFileSync(join(ROOT, relativePath), "utf8"))
    );
    expect(ownershipOwners).toEqual(
      expect.arrayContaining([
        "convex/crm/commandReceipts.ts",
        "convex/crm/proposalRelations.ts",
        "convex/crm/proposalWriteCommands.ts",
        "convex/crm/queryCreation.ts",
        "convex/crm/ticketCommands.ts",
      ])
    );
    for (const relativePath of ownershipOwners) {
      const source = readFileSync(join(ROOT, relativePath), "utf8");
      if (relativePath === "convex/crm/lib/e2eOwnership.ts") {
        continue;
      }
      if (RAW_WRITE_PATTERN.test(source)) {
        expect(source, relativePath).toMatch(OWNERSHIP_HELPER_PATTERN);
      }
    }
  });

  test("discovers command receipts and scheduled derivative writes outside a manual allowlist", () => {
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
    expect(metricSync).toContain("await hasActiveE2eRun(ctx)");
  });

  test("uses reviewed table cleanup order and restores patched reusable fixtures", () => {
    const ownership = readFileSync(join(ROOT, "convex/crm/lib/e2eOwnership.ts"), "utf8");
    const cleanup = readFileSync(join(ROOT, "convex/crm/e2eRunOwnership.ts"), "utf8");
    expect(ownership).toContain("E2E_CLEANUP_TABLE_ORDER");
    expect(ownership).toContain("patchWithE2eOwnership");
    expect(ownership).toContain("passengerExportOperations: 90");
    expect(ownership).toContain("passengerExportSourceChunks: 100");
    expect(ownership).toContain("recordPatchedStorageIds");
    expect(cleanup).toContain("by_runId_cleanupOrder_createdAt");
    expect(cleanup).toContain("ctx.db.replace");
    expect(cleanup).not.toContain("record.tableName as TableNames");
  });

  test("registers fail-closed setup, teardown, and interrupted-run cleanup", () => {
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
