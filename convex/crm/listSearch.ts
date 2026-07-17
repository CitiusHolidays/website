import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalMutation, query } from "../_generated/server";
import { requireStaff } from "./lib/staffAccess";
import { listSearchReadinessResultValidator } from "./miscReturnContracts";
import { mapInBoundedBatches } from "./paginationPolicy";
import { normalizePassportExpiryDate } from "./passportExpiry";

const SEARCH_RECONCILE_PAGE_SIZE = 50;
export const LIST_SEARCH_PROJECTION_VERSION = 1;
const SEARCH_RECONCILIATION_STALE_MS = 60 * 60 * 1000;
const TRAVEL_BATCH_CODE_PATTERN = /^B(\d+)$/;
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

export function summarizeListSearchReadiness(rows: SearchReadinessRow[], now?: number) {
  const details = Object.fromEntries(
    SEARCH_TABLES.map((table, index) => {
      const row = rows[index];
      const current = isCurrentListSearchReadiness(row);
      const stale = Boolean(
        now !== undefined &&
          row &&
          now - Number(row.updatedAt ?? row.startedAt ?? 0) >= SEARCH_RECONCILIATION_STALE_MS
      );
      const state = current
        ? stale
          ? "stale"
          : "ready"
        : stale
          ? "stale"
          : row?.reconciling
            ? "reconciling"
            : "pending";
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

async function startTableReconciliation(ctx: any, table: SearchTable) {
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
    await ctx.db.patch(existing._id, patch);
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
  await ctx.db.patch(state._id, {
    ready: true,
    reconciling: false,
    updatedAt: Date.now(),
  });
  return true;
}

async function readSearchReadiness(ctx: any, now?: number) {
  const rows = await Promise.all(
    SEARCH_TABLES.map((table) =>
      ctx.db
        .query("crmListSearchReadiness")
        .withIndex("by_table", (q: any) => q.eq("table", table))
        .unique()
    )
  );
  return summarizeListSearchReadiness(rows, now);
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

async function buildQueryProjection(ctx: any, row: any) {
  const patch: Record<string, unknown> = {
    listSearchText: buildQueryListSearchText(row),
  };
  if (row.attachmentCount !== undefined && row.attachmentPreview !== undefined) {
    return patch;
  }
  const attachments = await ctx.db
    .query("queryAttachments")
    .withIndex("by_queryId", (q: any) => q.eq("queryId", row._id))
    .collect();
  patch.attachmentCount = attachments.length;
  patch.attachmentPreview = attachments
    .sort((left: any, right: any) => right.createdAt - left.createdAt)
    .slice(0, 2)
    .map((attachment: any) => ({
      createdAt: attachment.createdAt,
      fileName: attachment.fileName,
      fileSize: attachment.fileSize,
      id: attachment._id,
      mimeType: attachment.mimeType,
    }));
  return patch;
}

async function buildJobCardProjection(ctx: any, row: any) {
  const patch: Record<string, unknown> = {
    listSearchText: buildJobCardListSearchText(row),
  };
  if (row.travelBatchCount !== undefined) {
    return patch;
  }
  const summaryRows = Array.isArray(row.travelBatchSummaries) ? row.travelBatchSummaries : [];
  const legacyRows =
    summaryRows.length > 0
      ? summaryRows
      : await ctx.db
          .query("travelBatches")
          .withIndex("by_jobCardId", (q: any) => q.eq("jobCardId", row._id))
          .take(101);
  if (legacyRows.length > 100) {
    throw new Error("Travel Batch counter requires bounded reconciliation");
  }
  patch.travelBatchCount = legacyRows.reduce((max: number, legacyBatch: any) => {
    const sequence = String(legacyBatch.batchCode ?? "").match(TRAVEL_BATCH_CODE_PATTERN);
    return Math.max(max, sequence ? Number(sequence[1]) : 0);
  }, 0);
  return patch;
}

async function buildListProjection(ctx: any, table: SearchTable, row: any) {
  if (table === "queries") {
    return await buildQueryProjection(ctx, row);
  }
  if (table === "jobCards") {
    return await buildJobCardProjection(ctx, row);
  }
  if (table === "proposals") {
    return { listSearchText: buildProposalListSearchText(row) };
  }
  const needsPassportProjection = row.hasPassportScan === undefined;
  const [job, batch, passport] = await Promise.all([
    ctx.db.get(row.jobCardId as Id<"jobCards">),
    row.travelBatchId
      ? ctx.db.get(row.travelBatchId as Id<"travelBatches">)
      : Promise.resolve(null),
    needsPassportProjection
      ? ctx.db
          .query("passportDetails")
          .withIndex("by_travellerId", (q: any) => q.eq("travellerId", row._id))
          .unique()
      : Promise.resolve(null),
  ]);
  return {
    ...(needsPassportProjection
      ? {
          hasPassportScan: Boolean(passport?.storageId),
          passportExpiryDate: normalizePassportExpiryDate(passport?.expiryDate),
        }
      : {}),
    listSearchText: buildTravellerListSearchText(row, {
      jobCode: job?.jobCode,
      travelBatchReference: batch?.batchReference ?? row.travelBatchReference,
    }),
    travelBatchCode: batch?.batchCode ?? row.travelBatchCode ?? "",
    travelBatchReference: batch?.batchReference ?? row.travelBatchReference ?? "",
  };
}

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
        await ctx.db.patch(row._id, projection);
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
});

export const reconcileAll = internalMutation({
  args: {},
  handler: async (ctx) => {
    const starts = await Promise.all(
      SEARCH_TABLES.map((table) => startTableReconciliation(ctx, table))
    );
    // Existing projections remain queryable during routine repair. A projection-version bump makes
    // only stale tables unready until their bounded pass reaches the end.
    return { scheduled: starts.filter((start) => start.scheduled).length };
  },
});
