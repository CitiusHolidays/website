import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  discoverConvexRegistrations,
  registrationsInSource,
} from "../config/release/convex-registration-inventory";

type CapabilityClass =
  | "admin-only"
  | "internal"
  | "migration"
  | "public-product"
  | "retired"
  | "server-only";

interface Capability {
  classification: CapabilityClass;
  kind: string;
  module: string;
  name: string;
}

const CONVEX_ROOT = dirname(fileURLToPath(import.meta.url));
const EXPECTED_CAPABILITY_HASH = "2098d4a5e0396729475cf01f0a1d3dd4dcd74f8129916e7a883dfa9686769e15";
const ALLOWED_REGISTRATION_FACTORIES = new Set(["crm/commercialFiles.ts:mutationWithAccess"]);

const ADMIN_ONLY_MODULES = new Set([
  "authEmailDeliveries",
  "crm/leaveApprovers",
  "crm/leavePolicy",
  "crm/productionTestLab",
  "crm/settings",
  "crm/staffImport",
  "crm/staffWorkbookUpdates",
  "sacredBharatEditionEvents",
]);

const AI_SERVER_ONLY_CAPABILITIES = new Set([
  "aiRuntime.consumeRateLimit",
  "aiRuntime.recordTelemetry",
]);

const PAYMENT_SERVER_ONLY_CAPABILITIES = new Set([
  "bookings.claimCheckoutIntentForOrder",
  "bookings.confirmBookingByOrderId",
  "bookings.createPendingBooking",
  "bookings.markPaymentFailedByOrderId",
  "bookings.markRefundedByPaymentId",
  "bookings.recordPaymentAuthorized",
]);

const PASSPORT_UPLOAD_SERVER_ONLY_CAPABILITIES = new Set([
  "crm/passportActions.discardPassportUpload",
  "crm/passportActions.encryptAndStorePassport",
  "crm/passportActions.generateUploadUrl",
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
  ...PASSPORT_UPLOAD_SERVER_ONLY_CAPABILITIES,
  "crm/settings.resolveOperationalControlsForGateway",
  "sacredBharatEditionEvents.recordEdition001EventGateway",
]);

function classify(module: string, name: string, kind: string): CapabilityClass {
  if (kind.startsWith("internal")) {
    return "internal";
  }
  if (module === "sacredBharat") {
    return "retired";
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
  test("Fails closed when an exported capability uses an unrecognized registration factory", () => {
    const source = `
      import { mutation } from "./_generated/server";
      function hiddenRegistration(config: object) { return mutation(config as never); }
      export const hiddenCapability = hiddenRegistration({ args: {}, returns: {}, handler() {} });
    `;
    expect(() => registrationsInSource(source, "fixture.ts")).toThrow(
      "Unrecognized Convex registration factory fixture.ts:hiddenRegistration"
    );
  });

  test("Every registered backend function is classified by the reviewed snapshot", () => {
    const capabilities = discoverCapabilities();
    expect(capabilities.length).toBeGreaterThan(200);
    expect(capabilityHash(capabilities)).toBe(EXPECTED_CAPABILITY_HASH);
  });

  test("Includes public queries registered through renamed constructor imports", () => {
    const capabilities = discoverCapabilities();
    for (const [module, name] of [
      ["crm/dashboard", "getPortalMetricCoverage"],
      ["crm/dashboard", "getPortalDashboardCapacity"],
      ["crm/dashboard", "getPortalDashboardActivity"],
      ["crm/dashboard", "getPortalSummary"],
      ["crm/queryAttachments", "listForQuery"],
      ["crm/queryAttachments", "getAttachmentRecord"],
    ] as const) {
      expect(capabilities).toContainEqual({
        classification: "public-product",
        kind: "query",
        module,
        name,
      });
    }
  });

  test("Classifies document preview access as public product and preparation as internal", () => {
    const capabilities = discoverCapabilities();
    for (const capability of [
      {
        classification: "public-product",
        kind: "query",
        module: "crm/documentPreview",
        name: "getStatus",
      },
      {
        classification: "public-product",
        kind: "mutation",
        module: "crm/documentPreview",
        name: "retry",
      },
      {
        classification: "public-product",
        kind: "action",
        module: "crm/documentPreviewActions",
        name: "getPreviewFile",
      },
      {
        classification: "internal",
        kind: "internalMutation",
        module: "crm/documentPreview",
        name: "claimNextPreparation",
      },
      {
        classification: "internal",
        kind: "internalAction",
        module: "crm/documentPreviewActions",
        name: "getClaimedSourceFile",
      },
      {
        classification: "internal",
        kind: "internalAction",
        module: "crm/documentPreviewActions",
        name: "completePreparation",
      },
    ] satisfies Capability[]) {
      expect(capabilities).toContainEqual(capability);
    }
  });

  test("Keeps passport upload custody and residual verification internal", () => {
    const capabilities = discoverCapabilities();
    for (const capability of [
      {
        classification: "internal",
        kind: "internalMutation",
        module: "crm/passportUploadTickets",
        name: "reserveEncryptedCleanup",
      },
      {
        classification: "internal",
        kind: "internalMutation",
        module: "crm/passportUploadTickets",
        name: "bindEncryptedCleanup",
      },
      {
        classification: "internal",
        kind: "internalMutation",
        module: "crm/passportUploadTickets",
        name: "recoverUnclaimedUpload",
      },
      {
        classification: "internal",
        kind: "internalMutation",
        module: "crm/passportUploadTickets",
        name: "recoverEncryptedCleanup",
      },
      {
        classification: "internal",
        kind: "internalMutation",
        module: "crm/passportUploadTickets",
        name: "retryPlaintextCleanup",
      },
      {
        classification: "internal",
        kind: "internalMutation",
        module: "crm/passportUploadTickets",
        name: "retryEncryptedCleanup",
      },
      {
        classification: "internal",
        kind: "internalQuery",
        module: "crm/passportUploadTickets",
        name: "verifyRecoveryResidualPage",
      },
      {
        classification: "internal",
        kind: "internalQuery",
        module: "crm/passportUploadTickets",
        name: "verifyEncryptedRecoveryResidualPage",
      },
      {
        classification: "internal",
        kind: "internalQuery",
        module: "crm/passportUploadTickets",
        name: "verifyCleanupResiduals",
      },
    ] satisfies Capability[]) {
      expect(capabilities).toContainEqual(capability);
    }
  });

  test("classifies the read-only Recovery Center projection", () => {
    const capabilities = discoverCapabilities();
    expect(capabilities).toEqual(
      expect.arrayContaining([
        {
          classification: "public-product",
          kind: "query",
          module: "crm/recoveryCenter",
          name: "listItems",
        },
      ])
    );
  });

  test("classifies authentication email health as exact-Admin evidence", () => {
    const capabilities = discoverCapabilities();
    expect(capabilities).toContainEqual({
      classification: "admin-only",
      kind: "query",
      module: "authEmailDeliveries",
      name: "getDeliveryHealth",
    });
  });

  test("Distinguishes public, server, internal, admin, and migration capabilities", () => {
    const capabilities = discoverCapabilities();
    const classes = new Set(capabilities.map((entry) => entry.classification));
    expect(classes).toEqual(
      new Set<CapabilityClass>([
        "admin-only",
        "internal",
        "migration",
        "public-product",
        "retired",
        "server-only",
      ])
    );
    for (const name of [
      "backfillSacredBharatLeaderboard",
      "verifySacredBharatLeaderboard",
      "getSacredBharatLeaderboardMigrationStatus",
      "backfillTravelBatchSummaries",
      "verifyTravelBatchSummaries",
      "getTravelBatchSummaryMigrationStatus",
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
        module: "crm/proposals",
        name: "getPairTimeline",
      },
      {
        classification: "public-product",
        kind: "query",
        module: "crm/proposals",
        name: "listLinkedQueriesPage",
      },
      {
        classification: "internal",
        kind: "internalMutation",
        module: "crm/queryCommercialProjection",
        name: "reconcileQueryCommercialProjection",
      },
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
        classification: "internal",
        kind: "internalMutation",
        module: "crm/listSearch",
        name: "reconcileDirtyPage",
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
      {
        classification: "internal",
        kind: "internalMutation",
        module: "crm/closedLeadStageMigration",
        name: "migrateClosedLeadStages",
      },
      {
        classification: "internal",
        kind: "internalMutation",
        module: "crm/closedLeadStageMigration",
        name: "verifyClosedLeadStages",
      },
      {
        classification: "internal",
        kind: "internalQuery",
        module: "crm/closedLeadStageMigration",
        name: "getClosedLeadStageMigrationStatus",
      },
      {
        classification: "public-product",
        kind: "mutation",
        module: "crm/queries",
        name: "applySalesDecision",
      },
      {
        classification: "public-product",
        kind: "mutation",
        module: "crm/queries",
        name: "updateContractingProgress",
      },
      {
        classification: "public-product",
        kind: "query",
        module: "crm/proposalAttachments",
        name: "getSummaryReadiness",
      },
      {
        classification: "internal",
        kind: "internalMutation",
        module: "crm/proposalAttachments",
        name: "startSummaryReconciliation",
      },
      {
        classification: "internal",
        kind: "internalMutation",
        module: "crm/proposalAttachments",
        name: "reconcileSummaryPage",
      },
      {
        classification: "public-product",
        kind: "query",
        module: "crm/notificationEmailLedger",
        name: "listDeliverySummary",
      },
      {
        classification: "internal",
        kind: "internalMutation",
        module: "crm/notificationEmailLedger",
        name: "startDeliverySummaryReconciliation",
      },
      {
        classification: "internal",
        kind: "internalMutation",
        module: "crm/notificationEmailLedger",
        name: "reconcileDeliverySummaryPage",
      },
      {
        classification: "public-product",
        kind: "query",
        module: "crm/activity",
        name: "notificationBellState",
      },
      {
        classification: "internal",
        kind: "internalMutation",
        module: "crm/notificationUnreadProjectionMigration",
        name: "startReconciliation",
      },
      {
        classification: "internal",
        kind: "internalMutation",
        module: "crm/notificationUnreadProjectionMigration",
        name: "reconcilePage",
      },
      {
        classification: "internal",
        kind: "internalMutation",
        module: "authEmailDeliveries",
        name: "recordOutcome",
      },
      {
        classification: "internal",
        kind: "internalQuery",
        module: "authEmailDeliveries",
        name: "getOutcome",
      },
      {
        classification: "internal",
        kind: "internalQuery",
        module: "authEmailDeliveries",
        name: "listRecentOutcomes",
      },
      {
        classification: "internal",
        kind: "internalMutation",
        module: "authEmailDeliveryIntents",
        name: "prepare",
      },
      {
        classification: "internal",
        kind: "internalQuery",
        module: "authEmailDeliveryIntents",
        name: "resolve",
      },
      {
        classification: "internal",
        kind: "internalMutation",
        module: "crm/commercialFiles",
        name: "continuePurgeExpired",
      },
      {
        classification: "internal",
        kind: "internalQuery",
        module: "crm/commercialFiles",
        name: "getPurgeStatus",
      },
      {
        classification: "internal",
        kind: "internalAction",
        module: "crm/invoiceOutstandingProjection",
        name: "processProjectionPage",
      },
      {
        classification: "internal",
        kind: "internalMutation",
        module: "crm/invoiceOutstandingProjection",
        name: "startProjectionReconciliation",
      },
      {
        classification: "public-product",
        kind: "query",
        module: "crm/leaveLapse",
        name: "getClSlLapseStatus",
      },
      {
        classification: "internal",
        kind: "internalAction",
        module: "crm/leaveLapse",
        name: "processClSlLapsePage",
      },
      {
        classification: "internal",
        kind: "internalMutation",
        module: "sacredBharatGroupMembershipMigration",
        name: "backfillGroupMemberCounts",
      },
      {
        classification: "internal",
        kind: "internalMutation",
        module: "sacredBharatGroupMembershipMigration",
        name: "verifyGroupMemberCounts",
      },
      {
        classification: "internal",
        kind: "internalQuery",
        module: "sacredBharatGroupMembershipMigration",
        name: "getGroupMemberCountMigrationStatus",
      },
      {
        classification: "internal",
        kind: "internalMutation",
        module: "sacredBharatLeaderboardRankMigration",
        name: "backfillLeaderboardRanks",
      },
      {
        classification: "internal",
        kind: "internalMutation",
        module: "sacredBharatLeaderboardRankMigration",
        name: "verifyLeaderboardRanks",
      },
      {
        classification: "internal",
        kind: "internalQuery",
        module: "sacredBharatLeaderboardRankMigration",
        name: "getLeaderboardRankMigrationStatus",
      },
    ] satisfies Capability[]) {
      expect(capabilities).toContainEqual(capability);
    }
    expect(capabilities).not.toContainEqual({
      classification: "internal",
      kind: "internalAction",
      module: "email",
      name: "send",
    });
  });

  test("Classifies every historical Sacred Bharat tracker registration as retired", () => {
    const capabilities = discoverCapabilities();
    const retired = capabilities.filter((entry) => entry.classification === "retired");

    expect(retired).toEqual(
      [
        ["archiveGroup", "mutation"],
        ["createGroup", "mutation"],
        ["getGroupLeaderboard", "query"],
        ["getLeaderboard", "query"],
        ["getLeaderboardWithMe", "query"],
        ["getMyLeaderboardRank", "query"],
        ["getMyPassportProfile", "query"],
        ["getMyProgress", "query"],
        ["getPublicPassportBySlug", "query"],
        ["joinGroupByInviteCode", "mutation"],
        ["leaveGroup", "mutation"],
        ["listMyGroups", "query"],
        ["markTempleVisited", "mutation"],
        ["mergeGuestProgress", "mutation"],
        ["renameGroup", "mutation"],
        ["rotateGroupInviteCode", "mutation"],
        ["setLeaderboardOptOut", "mutation"],
        ["toggleWishlistItem", "mutation"],
        ["unmarkTempleVisited", "mutation"],
        ["upsertMyPassportProfile", "mutation"],
      ].map(([name, kind]) => ({ classification: "retired", kind, module: "sacredBharat", name }))
    );
  });

  test("Retires the unused pending approval counter from the public export surface", () => {
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

  test("Exposes bounded inbound dismissal without the unrelated-query conversion escape hatch", () => {
    const capabilities = discoverCapabilities();
    expect(capabilities).toContainEqual({
      classification: "public-product",
      kind: "mutation",
      module: "crm/inboundQueryIntents",
      name: "dismiss",
    });
    expect(capabilities).not.toContainEqual(
      expect.objectContaining({
        module: "crm/inboundQueryIntents",
        name: "markConverted",
      })
    );
  });

  test("Classifies the reviewed customer and repair capabilities explicitly", () => {
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
        name: "getMyConfirmedTripPacket",
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

  test("Classifies identity migration and explicit Account Holder capabilities", () => {
    const capabilities = discoverCapabilities();
    expect(capabilities).toContainEqual({
      classification: "internal",
      kind: "internalMutation",
      module: "authIdentityMigration",
      name: "runAuthIdentityMigrationPage",
    });
    expect(capabilities).toContainEqual({
      classification: "internal",
      kind: "internalQuery",
      module: "authIdentityMigration",
      name: "getAuthIdentityMigrationStatus",
    });
    expect(capabilities).toContainEqual({
      classification: "internal",
      kind: "internalMutation",
      module: "authIdentityMigration",
      name: "runBookingEntitlementMigrationPage",
    });
    expect(capabilities).toContainEqual({
      classification: "internal",
      kind: "internalQuery",
      module: "authIdentityMigration",
      name: "getBookingEntitlementMigrationStatus",
    });
    expect(capabilities).toContainEqual({
      classification: "public-product",
      kind: "query",
      module: "customerConfirmedTrips",
      name: "listAccountHolderOptions",
    });
    expect(capabilities).toContainEqual({
      classification: "public-product",
      kind: "mutation",
      module: "customerConfirmedTrips",
      name: "grantConfirmedTripEntitlement",
    });
    expect(capabilities).toContainEqual({
      classification: "public-product",
      kind: "query",
      module: "customerConfirmedTrips",
      name: "getConfirmedTripAccessContext",
    });
    expect(capabilities).toContainEqual({
      classification: "public-product",
      kind: "query",
      module: "customerConfirmedTrips",
      name: "listConfirmedTripAccess",
    });
    expect(capabilities).toContainEqual({
      classification: "public-product",
      kind: "mutation",
      module: "customerConfirmedTrips",
      name: "revokeConfirmedTripEntitlement",
    });
    expect(capabilities).toContainEqual({
      classification: "public-product",
      kind: "mutation",
      module: "customerConfirmedTrips",
      name: "restoreConfirmedTripEntitlement",
    });
    expect(capabilities).toContainEqual({
      classification: "public-product",
      kind: "mutation",
      module: "userProfiles",
      name: "establishMyIdentity",
    });
  });

  test("Classifies Commercial Files product mutations and compatibility probes", () => {
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
    for (const name of ["canUploadToSource", "verifyLegacyResidualPage"]) {
      expect(capabilities).toContainEqual({
        classification: "internal",
        kind: "internalQuery",
        module: "crm/commercialFiles",
        name,
      });
    }
  });

  test("Classifies checkout consumption as server-only and reconciliation as Finance reads", () => {
    const capabilities = discoverCapabilities();
    expect(capabilities).toContainEqual({
      classification: "server-only",
      kind: "mutation",
      module: "bookings",
      name: "createPendingBooking",
    });
    for (const name of ["getTimeline", "listInbox"]) {
      expect(capabilities).toContainEqual({
        classification: "public-product",
        kind: "query",
        module: "crm/paymentReconciliation",
        name,
      });
    }
  });

  test("Server-only payment writers retain the secret guard", () => {
    const source = readFileSync(join(CONVEX_ROOT, "bookings.ts"), "utf8");
    for (const name of PAYMENT_SERVER_ONLY_CAPABILITIES) {
      expect(source).toContain(`export const ${name.split(".")[1]} = mutation`);
    }
    expect(source.match(/assertPaymentMutationSecret\(serverSecret\)/g)).toHaveLength(6);
  });

  test("Server-only passport upload actions retain the upload-edge secret guard", () => {
    const source = readFileSync(join(CONVEX_ROOT, "crm/passportActions.ts"), "utf8");
    for (const name of PASSPORT_UPLOAD_SERVER_ONLY_CAPABILITIES) {
      expect(source).toContain(`export const ${name.split(".")[1]} = action`);
    }
    expect(source.match(/assertUploadEdgeSecret\(args\.serverSecret\)/g)).toHaveLength(3);
  });

  test("Server-only AI runtime writers retain their secret guard", () => {
    const source = readFileSync(join(CONVEX_ROOT, "aiRuntime.ts"), "utf8");
    expect(source.match(/assertRuntimeSecret\(args\.secret\)/g)).toHaveLength(2);
  });

  test("Server-only E2E endpoints retain their secret guard", () => {
    const assertions = readFileSync(join(CONVEX_ROOT, "crm/e2eAssertions.ts"), "utf8");
    const fixtures = readFileSync(join(CONVEX_ROOT, "crm/e2eFixtures.ts"), "utf8");
    const ownership = readFileSync(join(CONVEX_ROOT, "crm/e2eRunOwnership.ts"), "utf8");
    const seed = readFileSync(join(CONVEX_ROOT, "crm/e2eSeedActions.ts"), "utf8");
    expect(assertions).toContain("export const travellerExists = internalQuery");
    expect(fixtures).toContain("export const createCustomerAccountJourney = internalMutation");
    expect(fixtures).toContain("assertE2eSecret()");
    expect(ownership).toContain("export const auditTarget = internalQuery");
    expect(ownership).toContain("assertE2eSecret()");
    expect(ownership).toContain("assertE2eTargetIdentity(args.targetId)");
    expect(seed).toContain("export const run = internalAction");
    expect(seed).toContain("assertE2eSecret()");
    expect(assertions).not.toContain("secret: v.string()");
    expect(seed).not.toContain("secret: v.string()");
  });

  test("classifies the runtime gateway, exact-Admin changes, and release-only setup separately", () => {
    const capabilities = discoverCapabilities();
    expect(capabilities).toContainEqual({
      classification: "server-only",
      kind: "mutation",
      module: "crm/settings",
      name: "resolveOperationalControlsForGateway",
    });
    expect(capabilities).toContainEqual({
      classification: "admin-only",
      kind: "mutation",
      module: "crm/settings",
      name: "applyOperationalChangeSet",
    });
    expect(capabilities).toContainEqual({
      classification: "admin-only",
      kind: "query",
      module: "crm/settings",
      name: "listOperationalControls",
    });
    expect(capabilities).toContainEqual({
      classification: "admin-only",
      kind: "query",
      module: "crm/settings",
      name: "getRuntimeHealth",
    });
    expect(capabilities).toContainEqual({
      classification: "admin-only",
      kind: "action",
      module: "crm/productionTestLab",
      name: "runRecipes",
    });
    expect(capabilities).toContainEqual({
      classification: "internal",
      kind: "internalMutation",
      module: "crm/settings",
      name: "beginOperationalEffectInternal",
    });
    expect(capabilities).toContainEqual({
      classification: "internal",
      kind: "internalMutation",
      module: "crm/settings",
      name: "activateOperationalControlPlane",
    });
    expect(capabilities).toContainEqual({
      classification: "internal",
      kind: "internalAction",
      module: "operationalScheduledJobs",
      name: "run",
    });
  });

  test("classifies Sacred Bharat Edition events as a server gateway plus exact-Admin metrics", () => {
    const capabilities = discoverCapabilities();
    expect(capabilities).toContainEqual({
      classification: "server-only",
      kind: "mutation",
      module: "sacredBharatEditionEvents",
      name: "recordEdition001EventGateway",
    });
    expect(capabilities).toContainEqual({
      classification: "admin-only",
      kind: "query",
      module: "sacredBharatEditionEvents",
      name: "getEdition001AttributionMetrics",
    });
    expect(capabilities).toContainEqual({
      classification: "internal",
      kind: "internalMutation",
      module: "sacredBharatEditionEvents",
      name: "cleanupExpiredRateLimitKeys",
    });
    expect(capabilities).toContainEqual({
      classification: "internal",
      kind: "internalMutation",
      module: "sacredBharatEditionEvents",
      name: "purgeEdition001Event",
    });
  });
});
