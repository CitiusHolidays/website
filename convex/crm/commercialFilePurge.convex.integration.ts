import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { propertiesWhen } from "../lib/runtimeValues";
import schema from "../schema";
import { modules } from "../test.setup";

interface PurgeResult {
  continuation: number;
  failedFiles: number;
  failedSessions: number;
  generation: number;
  processedFiles: number;
  processedSessions: number;
  purgedFiles: number;
  purgedSessions: number;
  runId: Id<"commercialFilePurgeRuns">;
  scheduled: boolean;
  stage: "upload_sessions" | "deleted_files";
  status: "queued" | "running" | "completed" | "completed_with_failures" | "failed";
}

const startPurge = makeFunctionReference<"mutation", Record<string, never>, PurgeResult>(
  "crm/commercialFiles:purgeExpired"
);
const continuePurge = makeFunctionReference<
  "mutation",
  { continuation: number; runId: Id<"commercialFilePurgeRuns"> },
  PurgeResult
>("crm/commercialFiles:continuePurgeExpired");
const getPurgeStatus = makeFunctionReference<"query", Record<string, never>, PurgeResult | null>(
  "crm/commercialFiles:getPurgeStatus"
);

const FIXED_NOW = new Date("2026-08-12T16:00:00.000Z");
const SENSITIVE_AUDIT_PATTERN = /https?:|token|secret|bytes/i;

function createHarness() {
  return convexTest({ modules, schema, transactionLimits: true });
}

async function insertCommercialFile(
  ctx: MutationCtx,
  args: {
    lifecycle: "active" | "deleted";
    purgeAfter?: number;
    storageId: Id<"_storage">;
    suffix: string;
  }
) {
  return await ctx.db.insert("commercialFiles", {
    category: "workingFile",
    createdAt: FIXED_NOW.getTime() - 1000,
    createdBy: "fixture",
    fileName: `fixture-${args.suffix}.pdf`,
    fileSize: 7,
    lifecycle: args.lifecycle,
    mimeType: "application/pdf",
    ...propertiesWhen(!(args.purgeAfter === undefined), () => ({ purgeAfter: args.purgeAfter })),
    sourceCode: `Q-${args.suffix}`,
    sourceId: `queries_${args.suffix}`,
    sourceLabel: `Query ${args.suffix}`,
    sourceType: "query",
    storageId: args.storageId,
    teamArea: "sales",
    updatedAt: FIXED_NOW.getTime() - 1000,
    uploaderTeam: "Sales",
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("registered Commercial File purge continuations", () => {
  test("purges several bounded pages exactly once and preserves shared storage", async () => {
    const t = createHarness();
    let sharedStorageId!: Id<"_storage">;
    for (let offset = 0; offset < 27; offset += 9) {
      await t.run(async (ctx) => {
        for (let index = offset; index < Math.min(27, offset + 9); index += 1) {
          const sessionStorageId = await ctx.storage.store(new Blob([`session-${index}`]));
          await ctx.db.insert("commercialFileUploadSessions", {
            authUserId: "fixture",
            category: "workingFile",
            createdAt: FIXED_NOW.getTime() - 2000,
            expiresAt: FIXED_NOW.getTime() - 1,
            sourceId: `queries_session_${index}`,
            sourceType: "query",
            storageId: sessionStorageId,
            teamArea: "sales",
            token: `session-${index}`,
          });
          const fileStorageId = await ctx.storage.store(new Blob([`file-${index}`]));
          await insertCommercialFile(ctx, {
            lifecycle: "deleted",
            purgeAfter: FIXED_NOW.getTime() - 1,
            storageId: fileStorageId,
            suffix: String(index),
          });
        }
      });
    }
    await t.run(async (ctx) => {
      sharedStorageId = await ctx.storage.store(new Blob(["shared"]));
      await insertCommercialFile(ctx, {
        lifecycle: "active",
        storageId: sharedStorageId,
        suffix: "shared-active",
      });
      await insertCommercialFile(ctx, {
        lifecycle: "deleted",
        purgeAfter: FIXED_NOW.getTime() - 1,
        storageId: sharedStorageId,
        suffix: "shared-deleted",
      });
      await ctx.db.insert("commercialFileUploadSessions", {
        authUserId: "fixture",
        category: "workingFile",
        createdAt: FIXED_NOW.getTime() - 2000,
        expiresAt: FIXED_NOW.getTime() - 1,
        sourceId: "queries_shared",
        sourceType: "query",
        storageId: sharedStorageId,
        teamArea: "sales",
        token: "session-shared",
      });
    });

    const started = await t.mutation(startPurge, {});
    expect(started).toMatchObject({ generation: 1, scheduled: true, status: "queued" });
    expect(await t.mutation(startPurge, {})).toMatchObject({
      generation: 1,
      scheduled: false,
      status: "queued",
    });
    const firstPage = await t.mutation(continuePurge, {
      continuation: 0,
      runId: started.runId,
    });
    expect(firstPage).toMatchObject({ continuation: 1, processedSessions: 10, status: "running" });
    const staleReplay = await t.mutation(continuePurge, {
      continuation: 0,
      runId: started.runId,
    });
    expect(staleReplay.processedSessions).toBe(10);

    await t.finishAllScheduledFunctions(() => vi.runAllTimers());

    expect(await t.query(getPurgeStatus, {})).toMatchObject({
      failedFiles: 0,
      failedSessions: 0,
      processedFiles: 28,
      processedSessions: 28,
      purgedFiles: 28,
      purgedSessions: 28,
      status: "completed",
    });
    await t.run(async (ctx) => {
      expect(await ctx.db.query("commercialFileUploadSessions").collect()).toHaveLength(0);
      expect(
        await ctx.db
          .query("commercialFiles")
          .withIndex("by_purgeAfter", (q) =>
            q.gt("purgeAfter", 0).lt("purgeAfter", FIXED_NOW.getTime())
          )
          .collect()
      ).toHaveLength(0);
      expect(await ctx.storage.get(sharedStorageId)).not.toBeNull();
      const active = await ctx.db
        .query("commercialFiles")
        .withIndex("by_storageId", (q) => q.eq("storageId", sharedStorageId))
        .unique();
      expect(active?.lifecycle).toBe("active");
      const audits = await ctx.db.query("activityLogs").withIndex("by_createdAt").collect();
      expect(audits.length).toBeGreaterThan(4);
      for (const audit of audits) {
        // SAFETY: This test controls the asserted value at the framework boundary below.
        const metadata = audit.metadata as {
          failedFiles: unknown[];
          failedSessionIds: unknown[];
          purgedFiles: unknown[];
        };
        expect(metadata.failedFiles.length).toBeLessThanOrEqual(10);
        expect(metadata.failedSessionIds.length).toBeLessThanOrEqual(10);
        expect(metadata.purgedFiles.length).toBeLessThanOrEqual(10);
        expect(JSON.stringify(metadata)).not.toMatch(SENSITIVE_AUDIT_PATTERN);
      }
    });
  });

  test("finishes with visible failures without starving later eligible files", async () => {
    const t = createHarness();
    for (let offset = 0; offset < 27; offset += 9) {
      await t.run(async (ctx) => {
        for (let index = offset; index < Math.min(27, offset + 9); index += 1) {
          const storageId = await ctx.storage.store(new Blob([`mixed-${index}`]));
          await insertCommercialFile(ctx, {
            lifecycle: index < 12 ? "active" : "deleted",
            purgeAfter: FIXED_NOW.getTime() - 1,
            storageId,
            suffix: `mixed-${index}`,
          });
        }
      });
    }

    await t.mutation(startPurge, {});
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());

    expect(await t.query(getPurgeStatus, {})).toMatchObject({
      failedFiles: 12,
      processedFiles: 27,
      purgedFiles: 15,
      scheduled: false,
      status: "completed_with_failures",
    });
    await t.run(async (ctx) => {
      const residual = await ctx.db
        .query("commercialFiles")
        .withIndex("by_purgeAfter", (q) =>
          q.gt("purgeAfter", 0).lt("purgeAfter", FIXED_NOW.getTime())
        )
        .collect();
      expect(residual).toHaveLength(12);
      expect(residual.every((row) => row.lifecycle === "active")).toBe(true);
    });
  });

  test("deletes storage after the last expired reference in the same page", async () => {
    const t = createHarness();
    let sharedStorageId!: Id<"_storage">;
    await t.run(async (ctx) => {
      sharedStorageId = await ctx.storage.store(new Blob(["shared-expired"]));
      await insertCommercialFile(ctx, {
        lifecycle: "deleted",
        purgeAfter: FIXED_NOW.getTime() - 1,
        storageId: sharedStorageId,
        suffix: "shared-expired-a",
      });
      await insertCommercialFile(ctx, {
        lifecycle: "deleted",
        purgeAfter: FIXED_NOW.getTime() - 1,
        storageId: sharedStorageId,
        suffix: "shared-expired-b",
      });
    });

    await t.mutation(startPurge, {});
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());

    expect(await t.query(getPurgeStatus, {})).toMatchObject({
      failedFiles: 0,
      processedFiles: 2,
      purgedFiles: 2,
      status: "completed",
    });
    await t.run(async (ctx) => {
      expect(
        await ctx.db
          .query("commercialFiles")
          .withIndex("by_storageId", (q) => q.eq("storageId", sharedStorageId))
          .collect()
      ).toHaveLength(0);
      expect(await ctx.storage.get(sharedStorageId)).toBeNull();
    });
  });
});
