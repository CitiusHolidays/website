import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import schema from "../schema";
import { modules } from "../test.setup";

const FIXED_NOW = Date.parse("2026-08-30T16:00:00.000Z");
const DIRECTOR = "auth_recovery_director";
const DIRECTOR_CEMENT = "auth_recovery_director_cement";
const OPERATIONS = "auth_recovery_operations";
const SALES = "auth_recovery_sales";
const ISSUER = "https://auth.citius.test";

const retryPassportCleanup = makeFunctionReference<
  "mutation",
  {
    cleanup:
      | { kind: "passport_upload_cleanup"; ticketId: Id<"passportUploadTickets"> }
      | {
          cleanupRecordId: Id<"passportUploadCleanupRecords">;
          kind: "passport_encrypted_cleanup";
        };
    commandId: string;
    expectedUpdatedAt: number;
  },
  { queued: boolean; replayed: boolean }
>("crm/passportCleanupCommands:retryPassportCleanup");

function actorKey(actor: string) {
  return `${ISSUER}|${actor}`;
}

function createHarness() {
  return convexTest({ modules, schema, transactionLimits: true });
}

type HarnessRunContext = Parameters<Parameters<ReturnType<typeof createHarness>["run"]>[0]>[0];

async function seedStaff(
  ctx: HarnessRunContext,
  args: { actor: string; email: string; name: string; roles: Doc<"staffUsers">["roles"] }
) {
  await ctx.db.insert("authIdentityLinks", {
    canonicalAuthUserId: actorKey(args.actor),
    createdAt: FIXED_NOW,
    legacyAuthUserId: args.actor,
    status: "linked",
    updatedAt: FIXED_NOW,
  });
  return await ctx.db.insert("staffUsers", {
    active: true,
    authUserId: args.actor,
    createdAt: FIXED_NOW,
    email: args.email,
    emailNormalized: args.email,
    name: args.name,
    roles: args.roles,
    updatedAt: FIXED_NOW,
  });
}

function identity(actor: string, email: string) {
  return {
    email,
    issuer: ISSUER,
    subject: actor,
    tokenIdentifier: actorKey(actor),
  };
}

async function seedRecoveryFixture(t: ReturnType<typeof createHarness>) {
  return await t.run(async (ctx) => {
    const directorStaffId = await seedStaff(ctx, {
      actor: DIRECTOR,
      email: "recovery-director@citius.test",
      name: "Recovery Director",
      roles: ["Directors"],
    });
    await seedStaff(ctx, {
      actor: SALES,
      email: "recovery-sales@citius.test",
      name: "Recovery Sales",
      roles: ["Sales"],
    });
    const jobCardId = await ctx.db.insert("jobCards", {
      clientName: "Recovery Fixture",
      confirmedPax: 4,
      createdAt: FIXED_NOW - 10_000,
      createdBy: actorKey(DIRECTOR),
      destination: "Goa",
      jobCode: "JC-RECOVERY-1",
      status: "Open",
      updatedAt: FIXED_NOW - 10_000,
    });
    const salesJobCardId = await ctx.db.insert("jobCards", {
      clientName: "Sales Hidden Fixture",
      confirmedPax: 2,
      createdAt: FIXED_NOW - 10_000,
      createdBy: actorKey(SALES),
      destination: "Delhi",
      jobCode: "JC-RECOVERY-2",
      status: "Open",
      updatedAt: FIXED_NOW - 10_000,
    });
    const insertExport = async (args: {
      commandId: string;
      initiatedBy: string;
      jobCardId: Id<"jobCards">;
      status: "completed" | "failed";
      updatedAt: number;
    }) =>
      await ctx.db.insert("passengerExportOperations", {
        attemptCount: 1,
        commandId: args.commandId,
        exportKind: "traveller",
        initiatedBy: args.initiatedBy,
        jobCardId: args.jobCardId,
        rowsProcessed: 4,
        startedAt: args.updatedAt - 1000,
        status: args.status,
        updatedAt: args.updatedAt,
      });
    const newestExportId = await insertExport({
      commandId: "018fbe7a-62c8-7f35-9d2f-2d3f53f9e201",
      initiatedBy: actorKey(DIRECTOR),
      jobCardId,
      status: "failed",
      updatedAt: FIXED_NOW - 10_000,
    });
    await insertExport({
      commandId: "018fbe7a-62c8-7f35-9d2f-2d3f53f9e202",
      initiatedBy: actorKey(DIRECTOR),
      jobCardId,
      status: "completed",
      updatedAt: FIXED_NOW - 20_000,
    });
    const oldestExportId = await insertExport({
      commandId: "018fbe7a-62c8-7f35-9d2f-2d3f53f9e203",
      initiatedBy: actorKey(DIRECTOR),
      jobCardId,
      status: "failed",
      updatedAt: FIXED_NOW - 30_000,
    });
    await insertExport({
      commandId: "018fbe7a-62c8-7f35-9d2f-2d3f53f9e204",
      initiatedBy: actorKey(SALES),
      jobCardId: salesJobCardId,
      status: "failed",
      updatedAt: FIXED_NOW - 10_000,
    });
    await ctx.db.insert("notificationEmailEventSummaries", {
      eventId: "recovery-email-event",
      exhausted: 1,
      queued: 0,
      retrying: 0,
      sending: 0,
      sent: 0,
      skipped: 0,
      total: 1,
      updatedAt: FIXED_NOW - 40_000,
    });
    await ctx.db.insert("notificationEmailEventOrigins", {
      audienceStaffIds: [directorStaffId],
      audienceUserIds: [],
      createdAt: FIXED_NOW - 40_000,
      entityId: String(jobCardId),
      entityType: "jobCard",
      eventId: "recovery-email-event",
      label: "Job Card assignment email",
    });
    await ctx.db.insert("portalWorkflowNudgeRuns", {
      checked: 20,
      continuationToken: 0,
      cursor: "cursor-1",
      key: "scheduled",
      referenceNow: FIXED_NOW - 60_000,
      retryCount: 0,
      sent: 3,
      stage: "travellers",
      startedAt: FIXED_NOW - 60_000,
      status: "failed",
      updatedAt: FIXED_NOW - 30_000,
    });
    return { directorStaffId, newestExportId, oldestExportId };
  });
}

async function seedPassportRecoveryFixture(t: ReturnType<typeof createHarness>) {
  const { directorStaffId } = await seedRecoveryFixture(t);
  return await t.run(async (ctx) => {
    await seedStaff(ctx, {
      actor: DIRECTOR_CEMENT,
      email: "recovery-director-cement@citius.test",
      name: "Recovery Director Cement",
      roles: ["Director Cement"],
    });
    const operationsStaffId = await seedStaff(ctx, {
      actor: OPERATIONS,
      email: "recovery-operations@citius.test",
      name: "Recovery Operations",
      roles: ["Operations"],
    });
    const visibleJobCardId = await ctx.db.insert("jobCards", {
      clientName: "Visible Passport Fixture",
      confirmedPax: 2,
      createdAt: FIXED_NOW - 20_000,
      createdBy: actorKey(DIRECTOR),
      destination: "Varanasi",
      jobCode: "JC-PASSPORT-VISIBLE",
      operationsOwnerId: operationsStaffId,
      operationsOwnerName: "Recovery Operations",
      status: "Open",
      updatedAt: FIXED_NOW - 20_000,
    });
    const hiddenJobCardId = await ctx.db.insert("jobCards", {
      clientName: "Hidden Passport Fixture",
      confirmedPax: 2,
      createdAt: FIXED_NOW - 20_000,
      createdBy: actorKey(DIRECTOR),
      destination: "Kochi",
      jobCode: "JC-PASSPORT-HIDDEN",
      status: "Open",
      updatedAt: FIXED_NOW - 20_000,
    });
    const insertTraveller = async (jobCardId: Id<"jobCards">, fullName: string) =>
      await ctx.db.insert("travellers", {
        callingStatus: "Pending",
        createdAt: FIXED_NOW - 20_000,
        createdBy: actorKey(DIRECTOR),
        foodPreference: "Veg",
        fullName,
        guestType: "Client",
        jobCardId,
        paymentType: "Company Paid",
        roomType: "Single",
        ticketStatus: "Pending Issue",
        updatedAt: FIXED_NOW - 20_000,
        visaRequired: true,
        visaStatus: "Not Started",
      });
    const visibleTravellerId = await insertTraveller(
      visibleJobCardId,
      "Sentinel Traveller Visible"
    );
    const hiddenTravellerId = await insertTraveller(hiddenJobCardId, "Sentinel Traveller Hidden");
    const insertTicket = async (args: {
      targetJobCardId: Id<"jobCards">;
      targetTravellerId: Id<"travellers">;
      updatedAt: number;
    }) =>
      await ctx.db.insert("passportUploadTickets", {
        actorId: "sentinel_actor@example.test",
        cleanupAttempts: 6,
        cleanupDegradedAt: args.updatedAt,
        createdAt: args.updatedAt - 20_000,
        expectedContentDigest: "content_digest_sentinel",
        expectedFileSize: 4242,
        expectedMimeType: "application/pdf",
        expiresAt: args.updatedAt + 60_000,
        failureCode: "cleanup_failed",
        purpose: "passport_scan",
        recoveryMatchCount: 1,
        recoveryResidualCount: 1,
        recoveryWindowEndsAt: args.updatedAt + 120_000,
        status: "cleanup_degraded",
        targetJobCardId: args.targetJobCardId,
        targetTravellerId: args.targetTravellerId,
        tokenDigest: "token_digest_sentinel",
        updatedAt: args.updatedAt,
      });
    const visibleTicketId = await insertTicket({
      targetJobCardId: visibleJobCardId,
      targetTravellerId: visibleTravellerId,
      updatedAt: FIXED_NOW - 10_000,
    });
    const otherVisibleTicketId = await insertTicket({
      targetJobCardId: visibleJobCardId,
      targetTravellerId: visibleTravellerId,
      updatedAt: FIXED_NOW - 8000,
    });
    const hiddenTicketId = await insertTicket({
      targetJobCardId: hiddenJobCardId,
      targetTravellerId: hiddenTravellerId,
      updatedAt: FIXED_NOW - 11_000,
    });
    await insertTicket({
      targetJobCardId: visibleJobCardId,
      targetTravellerId: hiddenTravellerId,
      updatedAt: FIXED_NOW - 12_000,
    });
    const encryptedCleanupId = await ctx.db.insert("passportUploadCleanupRecords", {
      attempts: 6,
      cleanupOwner: "sentinel_cleanup_owner",
      createdAt: FIXED_NOW - 30_000,
      degradedAt: FIXED_NOW - 9000,
      expectedContentDigest: "encrypted_content_digest_sentinel",
      expectedFileSize: 4343,
      failureCode: "storage_referenced",
      kind: "encrypted_candidate",
      recoveryMatchCount: 1,
      recoveryResidualCount: 1,
      recoveryWindowEndsAt: FIXED_NOW + 120_000,
      status: "degraded",
      ticketId: visibleTicketId,
      updatedAt: FIXED_NOW - 9000,
    });
    const encryptedRetryId = await ctx.db.insert("passportUploadCleanupRecords", {
      attempts: 6,
      cleanupOwner: "sentinel_cleanup_owner",
      createdAt: FIXED_NOW - 30_000,
      degradedAt: FIXED_NOW - 7000,
      expectedContentDigest: "encrypted_retry_digest_sentinel",
      expectedFileSize: 4444,
      failureCode: "cleanup_failed",
      kind: "encrypted_candidate",
      recoveryMatchCount: 1,
      recoveryResidualCount: 1,
      recoveryWindowEndsAt: FIXED_NOW + 120_000,
      status: "degraded",
      ticketId: visibleTicketId,
      updatedAt: FIXED_NOW - 7000,
    });
    const hiddenEncryptedCleanupId = await ctx.db.insert("passportUploadCleanupRecords", {
      attempts: 6,
      cleanupOwner: "hidden_encrypted_cleanup_owner_sentinel",
      createdAt: FIXED_NOW - 30_000,
      degradedAt: FIXED_NOW - 6000,
      expectedContentDigest: "hidden_encrypted_digest_sentinel",
      expectedFileSize: 4545,
      failureCode: "cleanup_failed",
      kind: "encrypted_candidate",
      recoveryMatchCount: 1,
      recoveryResidualCount: 1,
      recoveryWindowEndsAt: FIXED_NOW + 120_000,
      status: "degraded",
      ticketId: hiddenTicketId,
      updatedAt: FIXED_NOW - 6000,
    });
    return {
      directorStaffId,
      encryptedCleanupId,
      encryptedRetryId,
      hiddenEncryptedCleanupId,
      hiddenJobCardId,
      otherVisibleTicketId,
      visibleJobCardId,
      visibleTicketId,
      visibleTravellerId,
    };
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("registered Recovery Center boundary", () => {
  test("keeps filtered native pages reachable without inventing a cursor", async () => {
    const t = createHarness();
    const fixture = await seedRecoveryFixture(t);
    const asDirector = t.withIdentity(identity(DIRECTOR, "recovery-director@citius.test"));
    let cursor: string | null = null;
    const ids: string[] = [];
    let emptyActionablePages = 0;
    for (let pageNumber = 0; pageNumber < 5; pageNumber += 1) {
      // The cursor is returned by the prior registered query and passed back unchanged.
      const page: {
        continueCursor: string;
        isDone: boolean;
        page: Array<{ id: string }>;
      } = await asDirector.query(api.crm.recoveryCenter.listItems, {
        paginationOpts: { cursor, numItems: 1 },
        referenceNow: FIXED_NOW,
        source: "passenger_export" as const,
      });
      ids.push(...page.page.map((item) => item.id));
      if (page.page.length === 0) {
        emptyActionablePages += 1;
      }
      if (page.isDone) {
        break;
      }
      cursor = page.continueCursor;
    }

    expect(ids).toEqual([
      `passenger_export:${fixture.newestExportId}`,
      `passenger_export:${fixture.oldestExportId}`,
    ]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(emptyActionablePages).toBe(1);
  });

  test("re-authorizes every source and hides an owned row after role loss", async () => {
    const t = createHarness();
    await seedRecoveryFixture(t);
    const asSales = t.withIdentity(identity(SALES, "recovery-sales@citius.test"));

    const ownButUnauthorized = await asSales.query(api.crm.recoveryCenter.listItems, {
      paginationOpts: { cursor: null, numItems: 10 },
      referenceNow: FIXED_NOW,
      source: "passenger_export",
    });
    expect(ownButUnauthorized.page).toEqual([]);
    await expect(
      asSales.query(api.crm.recoveryCenter.listItems, {
        paginationOpts: { cursor: null, numItems: 10 },
        referenceNow: FIXED_NOW,
        source: "notification_email",
      })
    ).rejects.toThrow("FORBIDDEN");
    await expect(
      asSales.query(api.crm.recoveryCenter.listItems, {
        paginationOpts: { cursor: null, numItems: 10 },
        referenceNow: FIXED_NOW,
        source: "workflow_nudge",
      })
    ).rejects.toThrow("FORBIDDEN");
    await expect(
      asSales.query(api.crm.recoveryCenter.listItems, {
        paginationOpts: { cursor: null, numItems: 10 },
        referenceNow: FIXED_NOW,
        source: "passport_upload_cleanup",
      })
    ).rejects.toThrow("FORBIDDEN");
    await expect(
      asSales.query(api.crm.recoveryCenter.listItems, {
        paginationOpts: { cursor: null, numItems: 10 },
        referenceNow: FIXED_NOW,
        source: "passport_encrypted_cleanup",
      })
    ).rejects.toThrow("FORBIDDEN");
  });

  test("denies global Passport pagination to scoped access while preserving director scope", async () => {
    const t = createHarness();
    const fixture = await seedPassportRecoveryFixture(t);
    const scopedOperations = t.withIdentity(
      identity(OPERATIONS, "recovery-operations@citius.test")
    );
    const directorCement = t.withIdentity(
      identity(DIRECTOR_CEMENT, "recovery-director-cement@citius.test")
    );

    for (const source of ["passport_upload_cleanup", "passport_encrypted_cleanup"] as const) {
      let error: unknown;
      try {
        await scopedOperations.query(api.crm.recoveryCenter.listItems, {
          paginationOpts: { cursor: null, numItems: 1 },
          referenceNow: FIXED_NOW,
          source,
        });
      } catch (cause) {
        error = cause;
      }
      expect(String(error)).toContain("FORBIDDEN");
      expect(String(error)).not.toContain(String(fixture.hiddenEncryptedCleanupId));
      expect(String(error)).not.toContain("continueCursor");
    }

    const directorPage = await directorCement.query(api.crm.recoveryCenter.listItems, {
      paginationOpts: { cursor: null, numItems: 10 },
      referenceNow: FIXED_NOW,
      source: "passport_encrypted_cleanup",
    });
    expect(directorPage.page.map((item) => item.id)).toContain(
      `passport_encrypted_cleanup:${fixture.hiddenEncryptedCleanupId}`
    );
  });

  test("projects only exact-visible privacy-safe Passport cleanup work", async () => {
    const t = createHarness();
    const fixture = await seedPassportRecoveryFixture(t);
    const asDirector = t.withIdentity(identity(DIRECTOR, "recovery-director@citius.test"));

    const plaintext = await asDirector.query(api.crm.recoveryCenter.listItems, {
      paginationOpts: { cursor: null, numItems: 10 },
      referenceNow: FIXED_NOW,
      source: "passport_upload_cleanup",
    });
    expect(plaintext.page).toHaveLength(3);
    const visibleItem = plaintext.page.find(
      (item) => item.id === `passport_upload_cleanup:${fixture.visibleTicketId}`
    );
    expect(visibleItem).toMatchObject({
      href: `/portal/passport?jc=${fixture.visibleJobCardId}`,
      owner: { kind: "passport_operations", label: "Passport operations" },
      readiness: "retry_available",
      retry: {
        expectedUpdatedAt: FIXED_NOW - 10_000,
        kind: "passport_upload_cleanup",
        ticketId: fixture.visibleTicketId,
      },
      status: "retryable",
    });
    expect(JSON.stringify(plaintext.page)).not.toMatch(
      /Sentinel Traveller|sentinel_actor|content_digest_sentinel|token_digest_sentinel/i
    );

    const encrypted = await asDirector.query(api.crm.recoveryCenter.listItems, {
      paginationOpts: { cursor: null, numItems: 10 },
      referenceNow: FIXED_NOW,
      source: "passport_encrypted_cleanup",
    });
    expect(encrypted.page).toHaveLength(3);
    const referencedItem = encrypted.page.find(
      (item) => item.id === `passport_encrypted_cleanup:${fixture.encryptedCleanupId}`
    );
    expect(referencedItem).toMatchObject({
      href: `/portal/passport?jc=${fixture.visibleJobCardId}`,
      readiness: "manual_review",
      status: "failed",
    });
    expect(referencedItem).not.toHaveProperty("retry");
    expect(
      encrypted.page.find(
        (item) => item.id === `passport_encrypted_cleanup:${fixture.encryptedRetryId}`
      )
    ).toMatchObject({
      readiness: "retry_available",
      retry: { kind: "passport_encrypted_cleanup" },
      status: "retryable",
    });
    expect(
      encrypted.page.find(
        (item) => item.id === `passport_encrypted_cleanup:${fixture.hiddenEncryptedCleanupId}`
      )
    ).toMatchObject({
      href: `/portal/passport?jc=${fixture.hiddenJobCardId}`,
      readiness: "retry_available",
      status: "retryable",
    });
    expect(JSON.stringify(encrypted.page)).not.toMatch(
      /sentinel_cleanup_owner|encrypted_content_digest_sentinel|hidden_encrypted_cleanup_owner_sentinel|hidden_encrypted_digest_sentinel/i
    );
  });

  test("keeps global privacy-safe Passport rows reachable through native cursors", async () => {
    const t = createHarness();
    const fixture = await seedPassportRecoveryFixture(t);
    const asDirector = t.withIdentity(identity(DIRECTOR, "recovery-director@citius.test"));
    let cursor: string | null = null;
    const ids: string[] = [];
    for (let pageNumber = 0; pageNumber < 6; pageNumber += 1) {
      const page: {
        continueCursor: string;
        isDone: boolean;
        page: Array<{ id: string; summary: string }>;
      } = await asDirector.query(api.crm.recoveryCenter.listItems, {
        paginationOpts: { cursor, numItems: 1 },
        referenceNow: FIXED_NOW,
        source: "passport_encrypted_cleanup" as const,
      });
      ids.push(...page.page.map((item) => item.id));
      expect(JSON.stringify(page.page)).not.toMatch(
        /Sentinel Traveller|sentinel_actor|encrypted_.*digest_sentinel|cleanup_owner_sentinel/i
      );
      expect(page.page).toHaveLength(1);
      if (page.isDone) {
        break;
      }
      cursor = page.continueCursor;
    }

    expect(new Set(ids)).toEqual(
      new Set([
        `passport_encrypted_cleanup:${fixture.encryptedCleanupId}`,
        `passport_encrypted_cleanup:${fixture.encryptedRetryId}`,
        `passport_encrypted_cleanup:${fixture.hiddenEncryptedCleanupId}`,
      ])
    );
    expect(ids).toHaveLength(3);
  });

  test("rejects unauthenticated and missing-Visa Passport cleanup mutations", async () => {
    const t = createHarness();
    const fixture = await seedPassportRecoveryFixture(t);
    const args = {
      cleanup: { kind: "passport_upload_cleanup", ticketId: fixture.visibleTicketId },
      commandId: "018fbe7a-62c8-7f35-9d2f-2d3f53f9e405",
      expectedUpdatedAt: FIXED_NOW - 10_000,
    } as const;

    await expect(t.mutation(retryPassportCleanup, args)).rejects.toThrow("FORBIDDEN");
    await expect(
      t
        .withIdentity(identity(SALES, "recovery-sales@citius.test"))
        .mutation(retryPassportCleanup, args)
    ).rejects.toThrow("FORBIDDEN");
    await t.run(async (ctx) => {
      expect(
        (await ctx.db.query("commandReceipts").collect()).filter(
          (receipt) => receipt.operation === "passport_cleanup_retry"
        )
      ).toHaveLength(0);
    });
  });

  test("rejects a Passport retry when only the projected revision changes", async () => {
    const t = createHarness();
    const fixture = await seedPassportRecoveryFixture(t);
    const asDirector = t.withIdentity(identity(DIRECTOR, "recovery-director@citius.test"));
    const page = await asDirector.query(api.crm.recoveryCenter.listItems, {
      paginationOpts: { cursor: null, numItems: 10 },
      referenceNow: FIXED_NOW,
      source: "passport_upload_cleanup",
    });
    const retry = page.page.find(
      (item) => item.id === `passport_upload_cleanup:${fixture.visibleTicketId}`
    )?.retry;
    if (retry?.kind !== "passport_upload_cleanup") {
      throw new Error("Expected a reviewed Passport cleanup retry descriptor");
    }
    await t.run(async (ctx) => {
      await ctx.db.patch("passportUploadTickets", fixture.visibleTicketId, {
        updatedAt: retry.expectedUpdatedAt + 1,
      });
    });

    await expect(
      asDirector.mutation(retryPassportCleanup, {
        cleanup: { kind: retry.kind, ticketId: retry.ticketId },
        commandId: "018fbe7a-62c8-7f35-9d2f-2d3f53f9e407",
        expectedUpdatedAt: retry.expectedUpdatedAt,
      })
    ).rejects.toThrow("PASSPORT_CLEANUP_RETRY_STALE");
    await t.run(async (ctx) => {
      expect(await ctx.db.get("passportUploadTickets", fixture.visibleTicketId)).toMatchObject({
        failureCode: "cleanup_failed",
        recoveryResidualCount: 1,
        status: "cleanup_degraded",
        updatedAt: retry.expectedUpdatedAt + 1,
      });
      expect(
        (await ctx.db.query("commandReceipts").collect()).filter(
          (receipt) => receipt.operation === "passport_cleanup_retry"
        )
      ).toHaveLength(0);
    });
  });

  test("revalidates Passport scope and cleanup revision before a replay-safe retry", async () => {
    const t = createHarness();
    const fixture = await seedPassportRecoveryFixture(t);
    const asDirector = t.withIdentity(identity(DIRECTOR, "recovery-director@citius.test"));
    const page = await asDirector.query(api.crm.recoveryCenter.listItems, {
      paginationOpts: { cursor: null, numItems: 10 },
      referenceNow: FIXED_NOW,
      source: "passport_upload_cleanup",
    });
    const retry = page.page.find(
      (item) => item.id === `passport_upload_cleanup:${fixture.visibleTicketId}`
    )?.retry;
    if (retry?.kind !== "passport_upload_cleanup") {
      throw new Error("Expected a reviewed Passport cleanup retry descriptor");
    }
    const args = {
      cleanup: { kind: retry.kind, ticketId: retry.ticketId },
      commandId: "018fbe7a-62c8-7f35-9d2f-2d3f53f9e401",
      expectedUpdatedAt: retry.expectedUpdatedAt,
    } as const;

    const first = await asDirector.mutation(retryPassportCleanup, args);
    const replay = await asDirector.mutation(retryPassportCleanup, args);
    expect(first).toEqual({ queued: true, replayed: false });
    expect(replay).toEqual({ queued: true, replayed: true });
    await expect(
      asDirector.mutation(retryPassportCleanup, {
        ...args,
        expectedUpdatedAt: args.expectedUpdatedAt + 1,
      })
    ).rejects.toThrow("Command ID was already used with different input");
    await expect(
      asDirector.mutation(retryPassportCleanup, {
        ...args,
        cleanup: {
          kind: "passport_upload_cleanup",
          ticketId: fixture.otherVisibleTicketId,
        },
        expectedUpdatedAt: FIXED_NOW - 8000,
      })
    ).rejects.toThrow("Command ID was already used with different input");
    await expect(
      asDirector.mutation(retryPassportCleanup, {
        ...args,
        commandId: "018fbe7a-62c8-7f35-9d2f-2d3f53f9e402",
      })
    ).rejects.toThrow("PASSPORT_CLEANUP_RETRY_STALE");

    await t.run(async (ctx) => {
      await ctx.db.patch("staffUsers", fixture.directorStaffId, { roles: ["Sales"] });
    });
    await expect(asDirector.mutation(retryPassportCleanup, args)).rejects.toThrow("FORBIDDEN");

    await t.run(async (ctx) => {
      const ticket = await ctx.db.get("passportUploadTickets", fixture.visibleTicketId);
      expect(ticket).toMatchObject({
        recoveryResidualCount: 0,
        status: "issued",
      });
      expect(ticket).not.toHaveProperty("failureCode");
      const receipts = (await ctx.db.query("commandReceipts").collect()).filter(
        (receipt) => receipt.operation === "passport_cleanup_retry"
      );
      expect(receipts).toHaveLength(1);
      expect(receipts[0]).toMatchObject({
        commandId: args.commandId,
        resultId: `passport-upload:${fixture.visibleTicketId}`,
        targetId: `passport-upload:${fixture.visibleTicketId}`,
      });
      expect(JSON.stringify(receipts[0])).not.toMatch(
        /Sentinel Traveller|sentinel_actor|content_digest_sentinel|token_digest_sentinel/i
      );
    });
  });

  test("queues and replays a cleanup-failed encrypted Passport residual", async () => {
    const t = createHarness();
    const fixture = await seedPassportRecoveryFixture(t);
    const asDirector = t.withIdentity(identity(DIRECTOR, "recovery-director@citius.test"));
    const page = await asDirector.query(api.crm.recoveryCenter.listItems, {
      paginationOpts: { cursor: null, numItems: 10 },
      referenceNow: FIXED_NOW,
      source: "passport_encrypted_cleanup",
    });
    const retry = page.page.find(
      (item) => item.id === `passport_encrypted_cleanup:${fixture.encryptedRetryId}`
    )?.retry;
    if (retry?.kind !== "passport_encrypted_cleanup") {
      throw new Error("Expected a reviewed encrypted Passport cleanup retry descriptor");
    }
    const args = {
      cleanup: { cleanupRecordId: retry.cleanupRecordId, kind: retry.kind },
      commandId: "018fbe7a-62c8-7f35-9d2f-2d3f53f9e406",
      expectedUpdatedAt: retry.expectedUpdatedAt,
    } as const;

    await expect(asDirector.mutation(retryPassportCleanup, args)).resolves.toEqual({
      queued: true,
      replayed: false,
    });
    await expect(asDirector.mutation(retryPassportCleanup, args)).resolves.toEqual({
      queued: true,
      replayed: true,
    });
    await t.run(async (ctx) => {
      const record = await ctx.db.get("passportUploadCleanupRecords", fixture.encryptedRetryId);
      expect(record).toMatchObject({ recoveryResidualCount: 0, status: "reserved" });
      expect(record).not.toHaveProperty("failureCode");
      const receipts = (await ctx.db.query("commandReceipts").collect()).filter(
        (receipt) => receipt.operation === "passport_cleanup_retry"
      );
      expect(receipts).toHaveLength(1);
      expect(receipts[0]).toMatchObject({
        commandId: args.commandId,
        resultId: `passport-encrypted:${fixture.encryptedRetryId}`,
        targetId: `passport-encrypted:${fixture.encryptedRetryId}`,
      });
    });
  });

  test("rejects a Passport cleanup retry when the Traveller relation changes after projection", async () => {
    const t = createHarness();
    const fixture = await seedPassportRecoveryFixture(t);
    const asDirector = t.withIdentity(identity(DIRECTOR, "recovery-director@citius.test"));
    const page = await asDirector.query(api.crm.recoveryCenter.listItems, {
      paginationOpts: { cursor: null, numItems: 10 },
      referenceNow: FIXED_NOW,
      source: "passport_upload_cleanup",
    });
    const retry = page.page.find(
      (item) => item.id === `passport_upload_cleanup:${fixture.visibleTicketId}`
    )?.retry;
    if (retry?.kind !== "passport_upload_cleanup") {
      throw new Error("Expected a reviewed Passport cleanup retry descriptor");
    }
    await t.run(async (ctx) => {
      await ctx.db.patch("travellers", fixture.visibleTravellerId, {
        jobCardId: fixture.hiddenJobCardId,
      });
    });

    await expect(
      asDirector.mutation(retryPassportCleanup, {
        cleanup: { kind: retry.kind, ticketId: retry.ticketId },
        commandId: "018fbe7a-62c8-7f35-9d2f-2d3f53f9e403",
        expectedUpdatedAt: retry.expectedUpdatedAt,
      })
    ).rejects.toThrow("PASSPORT_CLEANUP_RETRY_UNAVAILABLE");
    await t.run(async (ctx) => {
      expect(
        (await ctx.db.query("commandReceipts").collect()).filter(
          (receipt) => receipt.operation === "passport_cleanup_retry"
        )
      ).toHaveLength(0);
    });
  });

  test("re-authorizes exact Job Card visibility before replaying a stored Passport receipt", async () => {
    const t = createHarness();
    const fixture = await seedPassportRecoveryFixture(t);
    const scopedOperations = t.withIdentity(
      identity(OPERATIONS, "recovery-operations@citius.test")
    );
    const args = {
      cleanup: { kind: "passport_upload_cleanup", ticketId: fixture.visibleTicketId },
      commandId: "018fbe7a-62c8-7f35-9d2f-2d3f53f9e408",
      expectedUpdatedAt: FIXED_NOW - 10_000,
    } as const;

    await expect(scopedOperations.mutation(retryPassportCleanup, args)).resolves.toEqual({
      queued: true,
      replayed: false,
    });
    await t.run(async (ctx) => {
      await ctx.db.patch("jobCards", fixture.visibleJobCardId, {
        operationsOwnerId: undefined,
        operationsOwnerName: undefined,
      });
    });

    await expect(scopedOperations.mutation(retryPassportCleanup, args)).rejects.toThrow(
      "PASSPORT_CLEANUP_RETRY_UNAVAILABLE"
    );
    await t.run(async (ctx) => {
      const receipts = (await ctx.db.query("commandReceipts").collect()).filter(
        (receipt) => receipt.operation === "passport_cleanup_retry"
      );
      expect(receipts).toHaveLength(1);
      expect(receipts[0]).toMatchObject({ commandId: args.commandId });
    });
  });

  test("projects only an authorized privacy-safe email summary with an owning link", async () => {
    const t = createHarness();
    await seedRecoveryFixture(t);
    const asDirector = t.withIdentity(identity(DIRECTOR, "recovery-director@citius.test"));
    const page = await asDirector.query(api.crm.recoveryCenter.listItems, {
      paginationOpts: { cursor: null, numItems: 10 },
      referenceNow: FIXED_NOW,
      source: "notification_email",
    });

    expect(page.page).toHaveLength(1);
    expect(page.page[0]).toMatchObject({
      href: expect.stringContaining("/portal/job-cards"),
      owner: { kind: "notification_owner" },
      readiness: "manual_review",
      status: "exhausted",
    });
    expect(page.page[0]?.summary).toContain("Notification email");
    expect(page.page[0]?.summary).not.toContain("Job Card assignment email");
    expect(page.page[0]?.summary).not.toContain("recovery-director@citius.test");
    expect(page.page[0]).not.toHaveProperty("retry");
  });

  test("replays the projected export command without creating a second operation", async () => {
    const t = createHarness();
    const fixture = await seedRecoveryFixture(t);
    const asDirector = t.withIdentity(identity(DIRECTOR, "recovery-director@citius.test"));
    const page = await asDirector.query(api.crm.recoveryCenter.listItems, {
      paginationOpts: { cursor: null, numItems: 10 },
      referenceNow: FIXED_NOW,
      source: "passenger_export",
    });
    const retry = page.page[0]?.retry;
    if (retry?.kind !== "passenger_export") {
      throw new Error("Expected the failed export to expose its reviewed retry command");
    }
    const args = {
      commandId: retry.commandId,
      exportKind: retry.exportKind,
      jobCardId: retry.jobCardId,
    };

    const first = await asDirector.action(api.crm.importActions.startPassengerExport, args);
    const replay = await asDirector.action(api.crm.importActions.startPassengerExport, args);

    expect(first).toEqual({ operationId: fixture.newestExportId });
    expect(replay).toEqual(first);
    await t.run(async (ctx) => {
      const matching = await ctx.db
        .query("passengerExportOperations")
        .withIndex("by_initiatedBy_exportKind_jobCardId_commandId", (q) =>
          q
            .eq("initiatedBy", actorKey(DIRECTOR))
            .eq("exportKind", retry.exportKind)
            .eq("jobCardId", retry.jobCardId)
            .eq("commandId", retry.commandId)
        )
        .collect();
      expect(matching).toHaveLength(1);
      expect(matching[0]).toMatchObject({ attemptCount: 2, status: "running" });
    });
  });

  test("fails closed when the previously authorized Staff identity is deactivated", async () => {
    const t = createHarness();
    const fixture = await seedRecoveryFixture(t);
    const asDirector = t.withIdentity(identity(DIRECTOR, "recovery-director@citius.test"));
    await t.run(async (ctx) => {
      await ctx.db.patch("staffUsers", fixture.directorStaffId, { active: false });
    });

    await expect(
      asDirector.query(api.crm.recoveryCenter.listItems, {
        paginationOpts: { cursor: null, numItems: 10 },
        referenceNow: FIXED_NOW,
        source: "passenger_export",
      })
    ).rejects.toThrow("FORBIDDEN");
  });
});
