import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { mapInBoundedBatches } from "./paginationPolicy";

const PROJECTION_TABLE = "proposalQueryLinks";
const PROJECTION_VERSION = 2;
export const PROPOSAL_LINKED_QUERY_PREVIEW_LIMIT = 3;
export const PROPOSAL_LINKED_QUERY_SUMMARY_VERSION = 1;
const RECONCILE_PAGE_SIZE = 50;
const RECONCILE_STALE_MS = 60 * 60 * 1000;

export function proposalLinkProjection(query: Doc<"queries">) {
  return {
    clientName: query.clientName,
    contractingOwnerId: query.contractingOwnerId ?? "",
    contractingOwnerName: query.contractingOwnerName ?? "",
    contractingOwnerNameNormalized: normalizeOwnerName(query.contractingOwnerName),
    contractingStatus: query.contractingStatus,
    paxCount: query.paxCount ?? 0,
    queryCode: query.queryCode,
    queryCreatedBy: query.createdBy,
    queryType: query.queryType,
    salesOwnerId: query.salesOwnerId ?? "",
    salesOwnerName: query.salesOwnerName ?? "",
    salesOwnerNameNormalized: normalizeOwnerName(query.salesOwnerName),
    salesStatus: query.salesStatus,
    ticketingOwnerId: query.ticketingOwnerId ?? "",
    ticketingOwnerName: query.ticketingOwnerName ?? "",
    ticketingOwnerNameNormalized: normalizeOwnerName(query.ticketingOwnerName),
    ticketingScope: query.ticketingScope ?? "",
  };
}

function normalizeOwnerName(value?: string | null) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

export function storedProposalQueryProjection(query: Doc<"queries">) {
  return {
    ...proposalLinkProjection(query),
    queryId: query._id,
  };
}

export function proposalLinkedQuerySummary(linkedQueries: Doc<"queries">[]) {
  return {
    linkedQueryCount: linkedQueries.length,
    linkedQueryPreview: linkedQueries
      .slice(0, PROPOSAL_LINKED_QUERY_PREVIEW_LIMIT)
      .map(storedProposalQueryProjection),
    linkedQuerySummaryGeneration: 0,
    linkedQuerySummaryState: "ready" as const,
    linkedQuerySummaryVersion: PROPOSAL_LINKED_QUERY_SUMMARY_VERSION,
  };
}

export function isProposalLinkProjectionComplete(link: Doc<"proposalQueryLinks">) {
  return (
    link.clientName !== undefined &&
    link.contractingOwnerNameNormalized !== undefined &&
    link.contractingStatus !== undefined &&
    link.paxCount !== undefined &&
    link.queryCode !== undefined &&
    link.queryCreatedBy !== undefined &&
    link.queryType !== undefined &&
    link.salesOwnerNameNormalized !== undefined &&
    link.salesStatus !== undefined &&
    link.ticketingOwnerNameNormalized !== undefined
  );
}

interface ProposalQueryVisibilitySource {
  clientName?: string;
  contractingOwnerId?: string;
  contractingOwnerName?: string;
  contractingStatus?: string;
  paxCount?: number;
  queryCode?: string;
  queryCreatedBy?: string;
  queryId: Id<"queries">;
  queryType?: string;
  salesOwnerId?: string;
  salesOwnerName?: string;
  salesStatus?: string;
  ticketingOwnerId?: string;
  ticketingOwnerName?: string;
  ticketingScope?: string;
}

export function queryVisibilityFromProposalLink(link: ProposalQueryVisibilitySource) {
  return {
    _id: link.queryId,
    clientName: link.clientName ?? "",
    contractingOwnerId: link.contractingOwnerId ?? "",
    contractingOwnerName: link.contractingOwnerName ?? "",
    contractingStatus: link.contractingStatus ?? "Query Received",
    createdBy: link.queryCreatedBy ?? "",
    paxCount: link.paxCount ?? 0,
    queryCode: link.queryCode ?? "",
    queryType: link.queryType ?? "MICE",
    salesOwnerId: link.salesOwnerId ?? "",
    salesOwnerName: link.salesOwnerName ?? "",
    salesStatus: link.salesStatus ?? "Under Discussion",
    ticketingOwnerId: link.ticketingOwnerId ?? "",
    ticketingOwnerName: link.ticketingOwnerName ?? "",
    ticketingScope: link.ticketingScope ?? "",
  };
}

export async function refreshProposalLinkProjections(ctx: MutationCtx, queryId: Id<"queries">) {
  await ctx.scheduler.runAfter(
    0,
    internal.crm.proposalLinkProjection.refreshProposalLinkProjectionPage,
    { cursor: null, queryId }
  );
  return 0;
}

export const refreshProposalLinkProjectionPage = internalMutation({
  args: {
    cursor: v.union(v.string(), v.null()),
    queryId: v.id("queries"),
  },
  handler: async (ctx, args) => {
    const query = await ctx.db.get("queries", args.queryId);
    if (!query) {
      return { isDone: true, processed: 0 };
    }
    const page = await ctx.db
      .query("proposalQueryLinks")
      .withIndex("by_queryId", (builder) => builder.eq("queryId", args.queryId))
      .paginate({ cursor: args.cursor, numItems: RECONCILE_PAGE_SIZE });
    await mapInBoundedBatches(page.page, async (link) =>
      ctx.db.patch("proposalQueryLinks", link._id, proposalLinkProjection(query))
    );
    if (!page.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.crm.proposalLinkProjection.refreshProposalLinkProjectionPage,
        { cursor: page.continueCursor, queryId: args.queryId }
      );
    }
    return { isDone: page.isDone, processed: page.page.length };
  },
  returns: v.object({ isDone: v.boolean(), processed: v.number() }),
});

async function loadReadiness(ctx: MutationCtx) {
  return await ctx.db
    .query("crmListSearchReadiness")
    .withIndex("by_table", (builder) => builder.eq("table", PROJECTION_TABLE))
    .unique();
}

export const reconcileProposalLinkProjections = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await loadReadiness(ctx);
    const now = Date.now();
    if (existing?.ready && existing.version === PROJECTION_VERSION && !existing.reconciling) {
      return { scheduled: false };
    }
    if (
      existing?.reconciling &&
      existing.version === PROJECTION_VERSION &&
      now - Number(existing.startedAt ?? existing.updatedAt) < RECONCILE_STALE_MS
    ) {
      return { scheduled: false };
    }
    const generation = Number(existing?.generation ?? 0) + 1;
    const patch = {
      generation,
      ready: false,
      reconciling: true,
      startedAt: now,
      table: PROJECTION_TABLE,
      updatedAt: now,
      version: PROJECTION_VERSION,
    };
    if (existing) {
      await ctx.db.patch(existing._id, patch);
    } else {
      await ctx.db.insert("crmListSearchReadiness", patch);
    }
    await ctx.scheduler.runAfter(0, internal.crm.proposalLinkProjection.reconcileProposalLinkPage, {
      cursor: null,
      generation,
    });
    return { scheduled: true };
  },
  returns: v.object({ scheduled: v.boolean() }),
});

export const reconcileProposalLinkPage = internalMutation({
  args: { cursor: v.union(v.string(), v.null()), generation: v.number() },
  handler: async (ctx, args) => {
    const state = await loadReadiness(ctx);
    if (
      !state?.reconciling ||
      state.generation !== args.generation ||
      state.version !== PROJECTION_VERSION
    ) {
      return { isDone: false, processed: 0, stale: true };
    }
    const page = await ctx.db
      .query("proposalQueryLinks")
      .paginate({ cursor: args.cursor, numItems: RECONCILE_PAGE_SIZE });
    const hydratedLinks = (
      await mapInBoundedBatches(page.page, async (link) => {
        const query = await ctx.db.get(link.queryId);
        return query ? { link, query } : null;
      })
    ).filter((entry): entry is NonNullable<typeof entry> => entry !== null);
    await mapInBoundedBatches(hydratedLinks, async ({ link, query }) =>
      ctx.db.patch(link._id, proposalLinkProjection(query))
    );
    if (page.isDone) {
      await ctx.db.patch(state._id, {
        ready: true,
        reconciling: false,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.scheduler.runAfter(
        0,
        internal.crm.proposalLinkProjection.reconcileProposalLinkPage,
        { cursor: page.continueCursor, generation: args.generation }
      );
    }
    return { isDone: page.isDone, processed: page.page.length, stale: false };
  },
  returns: v.object({
    isDone: v.boolean(),
    processed: v.number(),
    stale: v.boolean(),
  }),
});
