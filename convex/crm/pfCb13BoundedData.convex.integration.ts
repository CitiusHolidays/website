import { fromAny } from "@total-typescript/shoehorn";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";
import { LEGACY_CODE_SEED_SCAN_LIMIT, nextCode } from "./lib/codes";

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

async function seedApprovalRequests(t: Harness, count: number) {
  for (let offset = 0; offset < count; offset += 100) {
    const pageSize = Math.min(100, count - offset);
    await t.run(async (ctx) => {
      for (let index = 0; index < pageSize; index += 1) {
        const sequence = offset + index + 1;
        await ctx.db.insert("approvalRequests", {
          createdAt: FIXED_NOW.getTime(),
          entityId: `expense_${sequence}`,
          entityType: "expense",
          requestCode: `APR-${String(sequence).padStart(4, "0")}`,
          requestedBy: ACTOR,
          status: "Pending",
          summary: `Synthetic request ${sequence}`,
          type: "expense",
          updatedAt: FIXED_NOW.getTime(),
        });
      }
    });
  }
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
});

afterEach(() => {
  vi.useRealTimers();
});

describe("PF-CB-13 bounded CRM data contracts", () => {
  test("seeds once within the measured legacy bound and allocates atomically thereafter", async () => {
    const t = createHarness();
    await seedApprovalRequests(t, 430);

    const seededCode = await t.run(async (ctx) =>
      nextCode(fromAny(ctx), "approvalRequests", "APR")
    );
    expect(seededCode).toBe("APR-0431");

    const concurrentCodes = await Promise.all(
      Array.from({ length: 20 }, () =>
        t.run(async (ctx) => nextCode(fromAny(ctx), "approvalRequests", "APR"))
      )
    );
    expect(new Set(concurrentCodes).size).toBe(20);
    expect([...concurrentCodes].sort()).toEqual(
      Array.from({ length: 20 }, (_, index) => `APR-${String(index + 432).padStart(4, "0")}`)
    );

    await t.run(async (ctx) => {
      const sequence = await ctx.db
        .query("crmCodeSequences")
        .withIndex("by_key", (q) => q.eq("key", "approvalRequests:APR"))
        .unique();
      expect(sequence).toMatchObject({
        lastAllocated: 451,
        legacyRowsScanned: 430,
      });
    });
  });

  test("returns an actionable boundary error beyond the compatibility seed ceiling", async () => {
    const t = createHarness();
    await t.run(seedDirector);
    await seedQueries(t, LEGACY_CODE_SEED_SCAN_LIMIT + 1);

    await expect(
      asDirector(t).mutation(api.crm.queries.create, {
        clientName: "Sequence ceiling client",
        paxCount: 1,
        queryType: "FIT",
        travelType: "Domestic Travel",
      })
    ).rejects.toThrow("CRM code sequence queries:Q requires bounded reconciliation");
    await t.run(async (ctx) => {
      expect(await ctx.db.query("crmCodeSequences").collect()).toEqual([]);
      expect(await ctx.db.query("clients").collect()).toEqual([]);
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
