import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  discoverConvexRegistrations,
  registrationsInSource,
} from "../config/release/convex-registration-inventory";

type CapabilityClass = "admin-only" | "internal" | "migration" | "public-product" | "server-only";

interface Capability {
  classification: CapabilityClass;
  kind: string;
  module: string;
  name: string;
}

const CONVEX_ROOT = dirname(fileURLToPath(import.meta.url));
const EXPECTED_CAPABILITY_HASH = "87b53832232deb453fa44543b90e1c8af3e4eacc47bfe3f29fd7914e322f646b";
const ALLOWED_REGISTRATION_FACTORIES = new Set(["crm/commercialFiles.ts:mutationWithAccess"]);

const ADMIN_ONLY_MODULES = new Set([
  "crm/leaveApprovers",
  "crm/leavePolicy",
  "crm/settings",
  "crm/staffImport",
  "crm/staffWorkbookUpdates",
]);

const AI_SERVER_ONLY_CAPABILITIES = new Set([
  "aiRuntime.consumeRateLimit",
  "aiRuntime.recordTelemetry",
]);

const PAYMENT_SERVER_ONLY_CAPABILITIES = new Set([
  "bookings.confirmBookingByOrderId",
  "bookings.markPaymentFailedByOrderId",
  "bookings.markRefundedByPaymentId",
  "bookings.recordPaymentAuthorized",
]);

const E2E_SERVER_ONLY_CAPABILITIES = new Set([
  "crm/e2eAssertions.travellerExists",
  "crm/e2eSeedActions.cleanup",
  "crm/e2eSeedActions.run",
]);

const SERVER_ONLY_CAPABILITIES = new Set([
  ...AI_SERVER_ONLY_CAPABILITIES,
  ...E2E_SERVER_ONLY_CAPABILITIES,
  ...PAYMENT_SERVER_ONLY_CAPABILITIES,
]);

function classify(module: string, name: string, kind: string): CapabilityClass {
  if (kind.startsWith("internal")) {
    return "internal";
  }
  const identity = `${module}.${name}`;
  if (module === "migrations" || identity === "authSync.repairAuthLinks") {
    return "migration";
  }
  if (SERVER_ONLY_CAPABILITIES.has(identity)) {
    return "server-only";
  }
  if (ADMIN_ONLY_MODULES.has(module)) {
    return "admin-only";
  }
  return "public-product";
}

function discoverCapabilities(): Capability[] {
  return discoverConvexRegistrations(CONVEX_ROOT, ALLOWED_REGISTRATION_FACTORIES)
    .map(({ kind, module, name }) => ({
      classification: classify(module, name, kind),
      kind,
      module,
      name,
    }))
    .sort((left, right) =>
      `${left.module}.${left.name}`.localeCompare(`${right.module}.${right.name}`)
    );
}

function capabilityHash(capabilities: Capability[]) {
  const snapshot = capabilities
    .map(({ classification, kind, module, name }) => `${module}.${name}:${kind}:${classification}`)
    .join("\n");
  return createHash("sha256").update(snapshot).digest("hex");
}

describe("Convex capability inventory", () => {
  test("fails closed when an exported capability uses an unrecognized registration factory", () => {
    const source = `
      import { mutation } from "./_generated/server";
      function hiddenRegistration(config: object) { return mutation(config as never); }
      export const hiddenCapability = hiddenRegistration({ args: {}, returns: {}, handler() {} });
    `;
    expect(() => registrationsInSource(source, "fixture.ts")).toThrow(
      "Unrecognized Convex registration factory fixture.ts:hiddenRegistration"
    );
  });

  test("every registered backend function is classified by the reviewed snapshot", () => {
    const capabilities = discoverCapabilities();
    expect(capabilities.length).toBeGreaterThan(200);
    expect(capabilityHash(capabilities)).toBe(EXPECTED_CAPABILITY_HASH);
  });

  test("distinguishes public, server, internal, admin, and migration capabilities", () => {
    const capabilities = discoverCapabilities();
    const classes = new Set(capabilities.map((entry) => entry.classification));
    expect(classes).toEqual(
      new Set<CapabilityClass>([
        "admin-only",
        "internal",
        "migration",
        "public-product",
        "server-only",
      ])
    );
    for (const name of [
      "backfillSacredBharatLeaderboard",
      "verifySacredBharatLeaderboard",
      "getSacredBharatLeaderboardMigrationStatus",
      "migrateRoomTypes",
      "verifyRoomTypes",
      "getRoomTypeMigrationStatus",
    ]) {
      expect(capabilities).toContainEqual({
        classification: "internal",
        kind: name.startsWith("get") ? "internalQuery" : "internalMutation",
        module: "migrations",
        name,
      });
    }
    for (const capability of [
      {
        classification: "public-product",
        kind: "query",
        module: "crm/finance",
        name: "listFinanceOutstanding",
      },
      {
        classification: "public-product",
        kind: "query",
        module: "crm/finance",
        name: "listFinancePnl",
      },
      {
        classification: "internal",
        kind: "internalMutation",
        module: "crm/metricAggregates",
        name: "syncJobInvoicePage",
      },
      {
        classification: "public-product",
        kind: "mutation",
        module: "crm/workflowNudges",
        name: "classifyStaleNudgeRun",
      },
      {
        classification: "public-product",
        kind: "query",
        module: "crm/workflowNudges",
        name: "getNudgeRun",
      },
      {
        classification: "public-product",
        kind: "mutation",
        module: "crm/workflowNudges",
        name: "retryNudgeRun",
      },
      {
        classification: "internal",
        kind: "internalMutation",
        module: "crm/rateLimitMaintenance",
        name: "cleanupExpired",
      },
      {
        classification: "internal",
        kind: "internalMutation",
        module: "crm/rateLimitMaintenance",
        name: "consumePortalFileDownload",
      },
    ] satisfies Capability[]) {
      expect(capabilities).toContainEqual(capability);
    }
  });

  test("retires the unused pending approval counter from the public export surface", () => {
    const capabilities = discoverCapabilities();
    const approvalsSource = readFileSync(join(CONVEX_ROOT, "crm/approvals.ts"), "utf8");
    const exportSurface = readFileSync(join(CONVEX_ROOT, "_exportSurface.ts"), "utf8");

    expect(capabilities).not.toContainEqual({
      classification: "public-product",
      kind: "query",
      module: "crm/approvals",
      name: "pendingCount",
    });
    expect(approvalsSource).not.toContain("pendingCount");
    expect(exportSurface).not.toContain("crm_approvals.pendingCount");
  });

  test("classifies the reviewed customer and repair capabilities explicitly", () => {
    const capabilities = discoverCapabilities();
    for (const capability of [
      {
        classification: "public-product",
        kind: "query",
        module: "bookings",
        name: "getMyJourneyDetail",
      },
      {
        classification: "public-product",
        kind: "query",
        module: "bookings",
        name: "getMyJourneySummaries",
      },
      {
        classification: "public-product",
        kind: "query",
        module: "customerConfirmedTrips",
        name: "getMyConfirmedTripPackets",
      },
      {
        classification: "internal",
        kind: "internalMutation",
        module: "crm/customerAttributionMigration",
        name: "backfillCustomerAttribution",
      },
      {
        classification: "internal",
        kind: "internalMutation",
        module: "crm/expenseLifecycleMigration",
        name: "repairExpenseLifecycle",
      },
    ] as const) {
      expect(capabilities).toContainEqual(capability);
    }
  });

  test("includes wrapped Commercial Files mutations as public-product capabilities", () => {
    const capabilities = discoverCapabilities();
    for (const name of [
      "updateNote",
      "deleteFile",
      "deleteCurrentProposalDoc",
      "restoreFile",
      "restoreProposalHistory",
    ]) {
      expect(capabilities).toContainEqual({
        classification: "public-product",
        kind: "mutation",
        module: "crm/commercialFiles",
        name,
      });
    }
  });

  test("server-only payment writers retain the secret guard", () => {
    const source = readFileSync(join(CONVEX_ROOT, "bookings.ts"), "utf8");
    for (const name of PAYMENT_SERVER_ONLY_CAPABILITIES) {
      expect(source).toContain(`export const ${name.split(".")[1]} = mutation`);
    }
    expect(source.match(/assertPaymentMutationSecret\(args\.serverSecret\)/g)).toHaveLength(4);
  });

  test("server-only AI runtime writers retain their secret guard", () => {
    const source = readFileSync(join(CONVEX_ROOT, "aiRuntime.ts"), "utf8");
    expect(source.match(/assertRuntimeSecret\(args\.secret\)/g)).toHaveLength(2);
  });

  test("server-only E2E endpoints retain their secret guard", () => {
    const assertions = readFileSync(join(CONVEX_ROOT, "crm/e2eAssertions.ts"), "utf8");
    const seed = readFileSync(join(CONVEX_ROOT, "crm/e2eSeedActions.ts"), "utf8");
    expect(assertions).toContain("export const travellerExists = internalQuery");
    expect(seed).toContain("export const run = internalAction");
    expect(seed).toContain("assertE2eSecret()");
    expect(assertions).not.toContain("secret: v.string()");
    expect(seed).not.toContain("secret: v.string()");
  });
});
