import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx, query } from "../_generated/server";
import { type E2eOwnershipActor, insertWithE2eOwnership } from "./lib/e2eOwnership";
import { requireStaff } from "./lib/staffAccess";
import { listSearchReadinessResultValidator } from "./miscReturnContracts";
import { mapInBoundedBatches } from "./paginationPolicy";

const SEARCH_RECONCILE_PAGE_SIZE = 50;
const SEARCH_DIRTY_PAGE_SIZE = 50;
export const LIST_SEARCH_PROJECTION_VERSION = 2;
const SEARCH_RECONCILIATION_STALE_MS = 60 * 60 * 1000;
const searchTableValidator = v.union(
  v.literal("queries"),
  v.literal("jobCards"),
  v.literal("proposals"),
  v.literal("travellers")
);

type SearchTable = "jobCards" | "proposals" | "queries" | "travellers";
const SEARCH_TABLES: SearchTable[] = ["queries", "jobCards", "proposals", "travellers"];

type SearchReadinessRow = {
  generation?: number;
  ready?: boolean;
  reconciling?: boolean;
  startedAt?: number;
  updatedAt?: number;
  version?: number;
} | null;

function listSearchReadinessState(current: boolean, stale: boolean, reconciling: boolean) {
  if (current) {
    return "ready";
  }
  if (stale) {
    return "stale";
  }
  return reconciling ? "reconciling" : "pending";
}

export function summarizeListSearchReadiness(
  rows: SearchReadinessRow[],
  now?: number,
  oldestDirty?: { updatedAt: number } | null
) {
  const details = Object.fromEntries(
    SEARCH_TABLES.map((table, index) => {
      const row = rows[index];
      const current = isCurrentListSearchReadiness(row);
      const stale = Boolean(
        now !== undefined &&
          row &&
          !current &&
          now - Number(row.updatedAt ?? row.startedAt ?? 0) >= SEARCH_RECONCILIATION_STALE_MS
      );
      const state = listSearchReadinessState(current, stale, Boolean(row?.reconciling));
      return [
        table,
        {
          generation: Number(row?.generation ?? 0),
          state,
          updatedAt: row?.updatedAt ?? null,
          version: row?.version ?? null,
        },
      ];
    })
  ) as Record<
    SearchTable,
    { generation: number; state: string; updatedAt: number | null; version: number | null }
  >;
  const tables = Object.fromEntries(
    SEARCH_TABLES.map((table, index) => [table, isCurrentListSearchReadiness(rows[index])])
  ) as Record<SearchTable, boolean>;
  return {
    details,
    dirty: {
      hasPending: Boolean(oldestDirty),
      oldestUpdatedAt: oldestDirty ? oldestDirty.updatedAt : null,
    },
    errorSummary: null,
    ready: SEARCH_TABLES.every((table) => tables[table]),
    tables,
    version: LIST_SEARCH_PROJECTION_VERSION,
  };
}

export function isCurrentListSearchReadiness(
  row: { ready?: boolean; version?: number } | null | undefined
) {
  return row?.ready === true && row.version === LIST_SEARCH_PROJECTION_VERSION;
}

export async function assertListSearchReady(
  ctx: any,
  table: SearchTable,
  search: string | null | undefined
) {
  if (!search?.trim()) {
    return;
  }
  const row = await ctx.db
    .query("crmListSearchReadiness")
    .withIndex("by_table", (q: any) => q.eq("table", table))
    .unique();
  if (!isCurrentListSearchReadiness(row)) {
    throw new ConvexError("SEARCH_INDEX_PREPARING");
  }
}

async function loadTableReadiness(ctx: any, table: SearchTable) {
  return await ctx.db
    .query("crmListSearchReadiness")
    .withIndex("by_table", (q: any) => q.eq("table", table))
    .unique();
}

async function startTableReconciliation(ctx: any, table: SearchTable, force = false) {
  const existing = await loadTableReadiness(ctx, table);
  const now = Date.now();
  const currentGenerationActive = Boolean(
    existing?.reconciling &&
      existing.version === LIST_SEARCH_PROJECTION_VERSION &&
      now - Number(existing.startedAt ?? existing.updatedAt) < SEARCH_RECONCILIATION_STALE_MS
  );
  if (currentGenerationActive) {
    return { generation: Number(existing.generation ?? 0), scheduled: false };
  }
  if (isCurrentListSearchReadiness(existing) && !force) {
    return { generation: Number(existing.generation ?? 0), scheduled: false };
  }
  const generation = Number(existing?.generation ?? 0) + 1;
  const patch = {
    generation,
    ready: isCurrentListSearchReadiness(existing),
    reconciling: true,
    startedAt: now,
    table,
    updatedAt: now,
    version: LIST_SEARCH_PROJECTION_VERSION,
  };
  if (existing) {
    await ctx.db.patch("crmListSearchReadiness", existing._id, patch);
  } else {
    await ctx.db.insert("crmListSearchReadiness", patch);
  }
  await ctx.scheduler.runAfter(0, internal.crm.listSearch.reconcilePage, {
    cursor: null,
    generation,
    projectionVersion: LIST_SEARCH_PROJECTION_VERSION,
    table,
  });
  return { generation, scheduled: true };
}

async function isRegisteredTableGeneration(
  ctx: any,
  table: SearchTable,
  generation: number,
  projectionVersion: number
) {
  const state = await loadTableReadiness(ctx, table);
  return Boolean(
    state?.reconciling &&
      state.generation === generation &&
      state.version === projectionVersion &&
      projectionVersion === LIST_SEARCH_PROJECTION_VERSION
  );
}

async function completeTableReconciliation(
  ctx: any,
  table: SearchTable,
  generation: number,
  projectionVersion: number
) {
  const state = await loadTableReadiness(ctx, table);
  if (
    !(
      state?.reconciling &&
      state.generation === generation &&
      state.version === projectionVersion &&
      projectionVersion === LIST_SEARCH_PROJECTION_VERSION
    )
  ) {
    return false;
  }
  await ctx.db.patch("crmListSearchReadiness", state._id, {
    ready: true,
    reconciling: false,
    updatedAt: Date.now(),
  });
  return true;
}

async function readSearchReadiness(ctx: any, now?: number) {
  const [rows, oldestDirty] = await Promise.all([
    Promise.all(
      SEARCH_TABLES.map((table) =>
        ctx.db
          .query("crmListSearchReadiness")
          .withIndex("by_table", (q: any) => q.eq("table", table))
          .unique()
      )
    ),
    ctx.db.query("crmListSearchDirty").withIndex("by_updatedAt").first(),
  ]);
  return summarizeListSearchReadiness(rows, now, oldestDirty);
}

export const getReadiness = query({
  args: { referenceNow: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    return await readSearchReadiness(ctx, args.referenceNow);
  },
  returns: listSearchReadinessResultValidator,
});

function normalizeSearchParts(parts: unknown[]) {
  return Array.from(
    new Set(
      parts.flatMap((part) => {
        const value = String(part ?? "").trim();
        return value ? [value] : [];
      })
    )
  )
    .join(" ")
    .replace(/\s+/g, " ")
    .slice(0, 1024);
}

export function buildQueryListSearchText(row: Record<string, unknown>) {
  return normalizeSearchParts([
    row.queryCode,
    row.clientName,
    row.destination,
    row.queryType,
    row.salesOwnerName,
  ]);
}

export function buildJobCardListSearchText(job: Record<string, unknown>) {
  return normalizeSearchParts([job.jobCode, job.clientName, job.destination, job.queryType]);
}

export function buildProposalListSearchText(proposal: Record<string, unknown>) {
  return normalizeSearchParts([proposal.proposalCode, proposal.clientName, proposal.preparedBy]);
}

export function buildTravellerListSearchText(
  traveller: Record<string, unknown>,
  context: { jobCode?: unknown; travelBatchReference?: unknown } = {}
) {
  return normalizeSearchParts([
    traveller.fullName,
    context.jobCode,
    traveller.travelHub,
    traveller.sourceDealerName,
    traveller.passportStatus,
    traveller.hotelAllocation,
    traveller.roomType,
    context.travelBatchReference,
  ]);
}

function buildQueryProjection(row: Doc<"queries">) {
  return {
    listSearchText: buildQueryListSearchText(row),
  };
}

function buildJobCardProjection(row: Doc<"jobCards">) {
  return {
    listSearchText: buildJobCardListSearchText(row),
  };
}

interface ProposalProjectionPatch {
  listSearchText: string;
}

export function buildProposalProjection(row: Doc<"proposals">): ProposalProjectionPatch {
  return {
    listSearchText: buildProposalListSearchText(row),
  };
}

async function buildListProjection(ctx: MutationCtx, table: SearchTable, row: Doc<SearchTable>) {
  if (table === "queries") {
    return buildQueryProjection(row as Doc<"queries">);
  }
  if (table === "jobCards") {
    return buildJobCardProjection(row as Doc<"jobCards">);
  }
  if (table === "proposals") {
    return buildProposalProjection(row as Doc<"proposals">);
  }
  const traveller = row as Doc<"travellers">;
  const job = await ctx.db.get("jobCards", traveller.jobCardId);
  return {
    listSearchText: buildTravellerListSearchText(traveller, {
      jobCode: job?.jobCode,
      travelBatchReference: traveller.travelBatchReference,
    }),
  };
}

function dirtyKey(table: SearchTable, sourceId: string) {
  return `${table}:${sourceId}`;
}

export async function markListSearchDirty(
  ctx: MutationCtx,
  table: SearchTable,
  sourceId: string,
  actor?: E2eOwnershipActor
) {
  const key = dirtyKey(table, sourceId);
  const existing = await ctx.db
    .query("crmListSearchDirty")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
  const now = Date.now();
  if (existing) {
    await ctx.db.patch("crmListSearchDirty", existing._id, { updatedAt: now });
    return { queued: false };
  }
  await insertWithE2eOwnership(
    ctx,
    "crmListSearchDirty",
    {
      createdAt: now,
      key,
      sourceId,
      table,
      updatedAt: now,
    },
    actor
  );
  await ctx.scheduler.runAfter(0, internal.crm.listSearch.reconcileDirtyPage, {});
  return { queued: true };
}

function normalizeDirtySourceId(
  ctx: MutationCtx,
  table: SearchTable,
  sourceId: string
): Id<SearchTable> | null {
  if (table === "queries") {
    return ctx.db.normalizeId("queries", sourceId);
  }
  if (table === "jobCards") {
    return ctx.db.normalizeId("jobCards", sourceId);
  }
  if (table === "proposals") {
    return ctx.db.normalizeId("proposals", sourceId);
  }
  return ctx.db.normalizeId("travellers", sourceId);
}

async function loadDirtySourceRow(ctx: MutationCtx, table: SearchTable, sourceId: string) {
  const normalizedId = normalizeDirtySourceId(ctx, table, sourceId);
  if (!normalizedId) {
    return null;
  }
  if (table === "queries") {
    return await ctx.db.get("queries", normalizedId as Id<"queries">);
  }
  if (table === "jobCards") {
    return await ctx.db.get("jobCards", normalizedId as Id<"jobCards">);
  }
  if (table === "proposals") {
    return await ctx.db.get("proposals", normalizedId as Id<"proposals">);
  }
  return await ctx.db.get("travellers", normalizedId as Id<"travellers">);
}

export const reconcileDirtyPage = internalMutation({
  args: {},
  handler: async (ctx) => {
    const dirtyRows = await ctx.db
      .query("crmListSearchDirty")
      .withIndex("by_updatedAt")
      .order("asc")
      .take(SEARCH_DIRTY_PAGE_SIZE);
    const results = await mapInBoundedBatches(dirtyRows, async (dirty) => {
      const row = await loadDirtySourceRow(ctx, dirty.table, dirty.sourceId);
      let changed = false;
      if (row) {
        const projection = await buildListProjection(ctx, dirty.table, row);
        changed = Object.entries(projection).some(
          ([key, value]) => JSON.stringify(row[key as keyof typeof row]) !== JSON.stringify(value)
        );
        if (changed) {
          await ctx.db.patch(dirty.table, row._id, projection);
        }
      }
      await ctx.db.delete("crmListSearchDirty", dirty._id);
      return changed;
    });
    if (dirtyRows.length === SEARCH_DIRTY_PAGE_SIZE) {
      await ctx.scheduler.runAfter(0, internal.crm.listSearch.reconcileDirtyPage, {});
    }
    return {
      changed: results.filter(Boolean).length,
      processed: dirtyRows.length,
      scheduled: dirtyRows.length === SEARCH_DIRTY_PAGE_SIZE,
    };
  },
  returns: v.object({ changed: v.number(), processed: v.number(), scheduled: v.boolean() }),
});

export const reconcilePage = internalMutation({
  args: {
    cursor: v.union(v.string(), v.null()),
    generation: v.optional(v.number()),
    projectionVersion: v.optional(v.number()),
    table: searchTableValidator,
  },
  handler: async (ctx, args) => {
    if (
      args.generation === undefined ||
      args.projectionVersion !== LIST_SEARCH_PROJECTION_VERSION ||
      !(await isRegisteredTableGeneration(ctx, args.table, args.generation, args.projectionVersion))
    ) {
      const restart = await startTableReconciliation(ctx, args.table);
      return {
        changed: 0,
        isDone: false,
        processed: 0,
        restarted: restart.scheduled,
        stale: true,
      };
    }
    const page = await ctx.db
      .query(args.table)
      .order("asc")
      .paginate({ cursor: args.cursor, numItems: SEARCH_RECONCILE_PAGE_SIZE });
    const changedRows = await mapInBoundedBatches(page.page, async (row) => {
      const projection = await buildListProjection(ctx, args.table, row);
      const hasChanges = Object.entries(projection).some(
        ([key, value]) => JSON.stringify((row as any)[key]) !== JSON.stringify(value)
      );
      if (hasChanges) {
        await ctx.db.patch(args.table, row._id, projection);
      }
      return hasChanges;
    });
    const changed = changedRows.filter(Boolean).length;
    if (page.isDone) {
      await completeTableReconciliation(ctx, args.table, args.generation, args.projectionVersion);
    } else {
      await ctx.scheduler.runAfter(0, internal.crm.listSearch.reconcilePage, {
        cursor: page.continueCursor,
        generation: args.generation,
        projectionVersion: args.projectionVersion,
        table: args.table,
      });
    }
    return { changed, isDone: page.isDone, processed: page.page.length };
  },
  returns: v.object({
    changed: v.number(),
    isDone: v.boolean(),
    processed: v.number(),
    restarted: v.optional(v.boolean()),
    stale: v.optional(v.boolean()),
  }),
});

export const reconcileAll = internalMutation({
  args: { force: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const [dirty, ...starts] = await Promise.all([
      ctx.db.query("crmListSearchDirty").withIndex("by_updatedAt").first(),
      ...SEARCH_TABLES.map((table) => startTableReconciliation(ctx, table, args.force === true)),
    ]);
    if (dirty) {
      await ctx.scheduler.runAfter(0, internal.crm.listSearch.reconcileDirtyPage, {});
    }
    // Existing projections remain queryable during routine repair. A projection-version bump makes
    // only stale tables unready until their bounded pass reaches the end.
    return { scheduled: starts.filter((start) => start.scheduled).length + Number(Boolean(dirty)) };
  },
  returns: v.object({ scheduled: v.number() }),
});
