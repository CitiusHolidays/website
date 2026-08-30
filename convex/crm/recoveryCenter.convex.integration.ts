import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import schema from "../schema";
import { modules } from "../test.setup";

const FIXED_NOW = Date.parse("2026-08-30T16:00:00.000Z");
const DIRECTOR = "auth_recovery_director";
const SALES = "auth_recovery_sales";
const ISSUER = "https://auth.citius.test";

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
    if (!retry) {
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
