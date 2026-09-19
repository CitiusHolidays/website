import { fromAny } from "@total-typescript/shoehorn";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import schema from "../schema";
import { modules } from "../test.setup";

const ACTOR = "pf_cb_13_director";
const AUTH_ISSUER = "https://auth.citius.test";
const FIXED_NOW = new Date("2026-08-30T16:00:00.000Z");

function createHarness() {
  return convexTest({ modules, schema, transactionLimits: true });
}

type Harness = ReturnType<typeof createHarness>;
type HarnessRunContext = Parameters<Parameters<Harness["run"]>[0]>[0];

async function seedDirector(ctx: HarnessRunContext) {
  await ctx.db.insert("authIdentityLinks", {
    canonicalAuthUserId: `${AUTH_ISSUER}|${ACTOR}`,
    createdAt: FIXED_NOW.getTime(),
    legacyAuthUserId: ACTOR,
    status: "linked",
    updatedAt: FIXED_NOW.getTime(),
  });
  return await ctx.db.insert("staffUsers", {
    active: true,
    authUserId: ACTOR,
    createdAt: FIXED_NOW.getTime(),
    email: "pf-cb-13-director@citius-e2e.test",
    emailNormalized: "pf-cb-13-director@citius-e2e.test",
    name: "PF CB 13 Director",
    roles: ["Directors"],
    updatedAt: FIXED_NOW.getTime(),
  });
}

function asDirector(t: Harness) {
  return t.withIdentity({
    email: "pf-cb-13-director@citius-e2e.test",
    issuer: AUTH_ISSUER,
    subject: ACTOR,
    tokenIdentifier: `${AUTH_ISSUER}|${ACTOR}`,
  });
}

async function seedQueries(t: Harness, count: number) {
  for (let offset = 0; offset < count; offset += 100) {
    const pageSize = Math.min(100, count - offset);
    await t.run(async (ctx) => {
      for (let index = 0; index < pageSize; index += 1) {
        const sequence = offset + index + 1;
        await ctx.db.insert("queries", {
          clientName: `Synthetic client ${sequence}`,
          contractingStatus: "Query Received",
          createdAt: FIXED_NOW.getTime(),
          createdBy: ACTOR,
          paxCount: 1,
          queryCode: `Q-${String(sequence).padStart(4, "0")}`,
          queryType: "FIT",
          salesStatus: "Proposal in discussion",
          travelType: "Domestic Travel",
          updatedAt: FIXED_NOW.getTime(),
        });
      }
    });
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
  vi.stubEnv("OPERATIONAL_CONTROL_SOURCE_REVISION", "pf-cb-13-test-revision");
  vi.stubEnv("OPERATIONAL_CONTROL_TARGET_ID", "development:pf-cb-13-test");
  vi.stubEnv("VERCEL_ENV", "development");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("PF-CB-13 bounded CRM data contracts", () => {
  test("creates the next Query from existing data without a migration", async () => {
    const t = createHarness();
    const staffId = await t.run(seedDirector);
    await seedQueries(t, 3);
    const result = await asDirector(t).mutation(api.crm.queries.create, {
      clientName: "Existing CRM workflow",
      paxCount: 1,
      queryType: "FIT",
      travelType: "Domestic Travel",
    });
    expect(result.queryCode).toBe("Q-0004");
    await t.run(async (ctx) => {
      expect(await ctx.db.get("queries", result.id)).toMatchObject({
        salesOwnerId: staffId,
        salesOwnerName: "PF CB 13 Director",
      });
      expect(await ctx.db.query("crmCodeSequences").collect()).toEqual([]);
      expect(await ctx.db.query("dataMigrationRegistry").collect()).toEqual([]);
    });
  });

  test("preserves a main-era Director owner through stable ID mapping and name changes", async () => {
    const t = createHarness();
    const staffId = await t.run(seedDirector);
    await seedQueries(t, 1);
    const queryId = await t.run(async (ctx) => {
      const row = await ctx.db.query("queries").unique();
      if (!row) {
        throw new Error("Missing query fixture");
      }
      await ctx.db.patch("queries", row._id, {
        salesOwnerId: ACTOR,
        salesOwnerName: "PF CB 13 Director",
      });
      return row._id;
    });
    const row = await asDirector(t).query(api.crm.queries.getListRow, { queryId });
    expect(row?.salesOwnerId).toBe(staffId);
    expect(row?.salesOwnerName).toBe("PF CB 13 Director");
    await asDirector(t).mutation(api.crm.queries.update, {
      notes: "Updated note",
      queryId,
      salesOwnerName: row?.salesOwnerName,
      salesOwnerStaffId: row?.salesOwnerId,
    });
    await t.run(async (ctx) => {
      expect(await ctx.db.get("queries", queryId)).toMatchObject({
        notes: "Updated note",
        salesOwnerId: staffId,
      });
      await ctx.db.patch("staffUsers", staffId, { name: "Renamed Director" });
    });
    const renamed = await asDirector(t).query(api.crm.queries.getListRow, { queryId });
    await asDirector(t).mutation(api.crm.queries.update, {
      notes: "Updated after rename",
      queryId,
      salesOwnerName: renamed?.salesOwnerName,
      salesOwnerStaffId: renamed?.salesOwnerId,
    });
    await t.run(async (ctx) => {
      expect(await ctx.db.get("queries", queryId)).toMatchObject({
        notes: "Updated after rename",
        salesOwnerId: staffId,
        salesOwnerName: "Renamed Director",
      });
    });
  });

  test("still requires an active Sales Rep for an actual owner reassignment", async () => {
    const t = createHarness();
    await t.run(seedDirector);
    const ownerOptions: Array<{
      active: boolean;
      name: string;
      roles: Doc<"staffUsers">["roles"];
    }> = [
      { active: true, name: "Another Director", roles: ["Directors"] },
      { active: false, name: "Inactive Sales", roles: ["Sales"] },
      { active: true, name: "Active Sales", roles: ["Sales"] },
    ];
    const ownerIds = await t.run(async (ctx) =>
      Promise.all(
        ownerOptions.map((owner, index) =>
          ctx.db.insert("staffUsers", {
            ...owner,
            authUserId: `sales_owner_${index}`,
            createdAt: FIXED_NOW.getTime(),
            email: `sales-owner-${index}@citius-e2e.test`,
            emailNormalized: `sales-owner-${index}@citius-e2e.test`,
            updatedAt: FIXED_NOW.getTime(),
          })
        )
      )
    );
    const query = await asDirector(t).mutation(api.crm.queries.create, {
      clientName: "Owner validation",
      paxCount: 1,
      queryType: "FIT",
      travelType: "Domestic Travel",
    });
    await Promise.all(
      ownerIds.slice(0, 2).map((salesOwnerStaffId) =>
        expect(
          asDirector(t).mutation(api.crm.queries.update, {
            queryId: query.id,
            salesOwnerStaffId,
          })
        ).rejects.toThrow("Select an active Sales Rep")
      )
    );
    await asDirector(t).mutation(api.crm.queries.update, {
      queryId: query.id,
      salesOwnerName: "Client-supplied label",
      salesOwnerStaffId: ownerIds[2],
    });
    await t.run(async (ctx) => {
      expect(await ctx.db.get("queries", query.id)).toMatchObject({
        salesOwnerId: ownerIds[2],
        salesOwnerName: "Active Sales",
      });
    });
  });

  test("marks a large history while descending continuation leaves new notifications unread", async () => {
    const t = createHarness();
    await t.run(async (ctx) => {
      await seedDirector(ctx);
      for (let index = 0; index < 125; index += 1) {
        await ctx.db.insert("notifications", {
          body: `Visible notification ${index}`,
          createdAt: FIXED_NOW.getTime() - 10_000 + index,
          recipientRole: "Directors",
          title: `Visible ${index}`,
        });
      }
      for (let index = 0; index < 25; index += 1) {
        await ctx.db.insert("notifications", {
          body: `Other-role notification ${index}`,
          createdAt: FIXED_NOW.getTime() - 5000 + index,
          recipientRole: "Sales",
          title: `Other role ${index}`,
        });
      }
    });

    const actor = asDirector(t);
    let continuationCursor: string | null = null;
    let isDone = false;
    let marked = 0;
    let pages = 0;
    while (!isDone) {
      const {
        continueCursor,
        isDone: pageIsDone,
        marked: pageMarked,
        scanned,
      }: {
        continueCursor: string;
        isDone: boolean;
        marked: number;
        scanned: number;
      } = await actor.mutation(api.crm.activity.markAllNotificationsRead, {
        continuationCursor,
      });
      expect(scanned).toBeLessThanOrEqual(50);
      continuationCursor = continueCursor;
      isDone = pageIsDone;
      marked += pageMarked;
      pages += 1;
      if (pages === 1) {
        vi.setSystemTime(FIXED_NOW.getTime() + 1000);
        await t.run(async (ctx) => {
          await ctx.db.insert("notifications", {
            body: "Created while mark-all is continuing",
            createdAt: FIXED_NOW.getTime() + 500,
            recipientRole: "Directors",
            title: "New during mark-all",
          });
        });
      }
    }

    expect(pages).toBe(3);
    expect(marked).toBe(125);
    await t.run(async (ctx) => {
      const receipts = await ctx.db.query("notificationReads").collect();
      expect(receipts).toHaveLength(125);
      expect(new Set(receipts.map((receipt) => receipt.readAt))).toEqual(
        new Set([FIXED_NOW.getTime(), FIXED_NOW.getTime() + 1000])
      );
    });
  });

  test("rejects malformed and oversized legacy checklist payloads before storage", async () => {
    const t = createHarness();
    const jobCardId = await t.run(async (ctx) => {
      await seedDirector(ctx);
      return await ctx.db.insert("jobCards", {
        clientName: "PF-CB-13 client",
        confirmedPax: 2,
        createdAt: FIXED_NOW.getTime(),
        createdBy: ACTOR,
        jobCode: "JC-9001-PC",
        status: "Open",
        updatedAt: FIXED_NOW.getTime(),
      });
    });
    const actor = asDirector(t);

    await expect(
      actor.mutation(
        api.crm.jobCards.updateChecklist,
        fromAny<never, unknown>({ checklist: [{ label: 123 }], jobCardId })
      )
    ).rejects.toThrow();
    await expect(
      actor.mutation(api.crm.jobCards.updateChecklist, {
        checklist: Array.from({ length: 101 }, (_, index) => ({
          done: false,
          key: `item-${index}`,
          label: `Checklist item ${index}`,
        })),
        jobCardId,
      })
    ).rejects.toThrow("cannot exceed 100 items");
    await expect(
      actor.mutation(api.crm.jobCards.updateChecklist, {
        checklist: [{ label: "x".repeat(501) }],
        jobCardId,
      })
    ).rejects.toThrow("fields cannot exceed 500 characters");
    await expect(
      actor.mutation(api.crm.jobCards.updateChecklist, {
        checklist: Array.from({ length: 100 }, () => ({
          category: "x".repeat(100),
          dueDate: "x".repeat(100),
          key: "x".repeat(100),
          label: "x".repeat(100),
          owner: "x".repeat(100),
          status: "x".repeat(100),
          title: "x".repeat(100),
        })),
        jobCardId,
      })
    ).rejects.toThrow("text cannot exceed 64000 characters");

    await expect(
      actor.mutation(api.crm.jobCards.updateChecklist, {
        checklist: [{ done: false, key: "bounded", label: "Bounded checklist item" }],
        jobCardId,
      })
    ).resolves.toEqual({ id: jobCardId });
  });

  test("derives workflow-run staleness only from the validated query reference time", async () => {
    const t = createHarness();
    const updatedAt = FIXED_NOW.getTime() - 60_000;
    await t.run(async (ctx) => {
      await seedDirector(ctx);
      await ctx.db.insert("portalWorkflowNudgeRuns", {
        checked: 10,
        cursor: null,
        key: "scheduled",
        referenceNow: updatedAt,
        sent: 2,
        stage: "queries",
        startedAt: updatedAt,
        status: "running",
        updatedAt,
      });
    });
    const actor = asDirector(t);

    const beforeBoundary = await actor.query(api.crm.workflowNudges.getNudgeRun, {
      referenceNow: updatedAt + 15 * 60 * 1000 - 1,
      runKey: "scheduled",
    });
    const atBoundary = await actor.query(api.crm.workflowNudges.getNudgeRun, {
      referenceNow: updatedAt + 15 * 60 * 1000,
      runKey: "scheduled",
    });
    expect(beforeBoundary).toMatchObject({
      effectiveStatus: "running",
      healthStatus: "healthy",
      referenceNow: updatedAt + 15 * 60 * 1000 - 1,
    });
    expect(atBoundary).toMatchObject({
      effectiveStatus: "stale",
      healthStatus: "attention",
      referenceNow: updatedAt + 15 * 60 * 1000,
    });
    await expect(
      actor.query(api.crm.workflowNudges.getNudgeRun, {
        referenceNow: -1,
        runKey: "scheduled",
      })
    ).rejects.toThrow("valid reference time");
  });
});
