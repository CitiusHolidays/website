import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation } from "../_generated/server";
import { compactPageItems, mapInBoundedBatches } from "./paginationPolicy";
import {
  PROPOSAL_LINKED_QUERY_PREVIEW_LIMIT,
  PROPOSAL_LINKED_QUERY_SUMMARY_VERSION,
  storedProposalQueryProjection,
} from "./proposalLinkProjection";

const RECONCILE_PAGE_SIZE = 50;

export const reconcileProposalRelationSummary = internalMutation({
  args: {
    count: v.number(),
    cursor: v.union(v.string(), v.null()),
    generation: v.number(),
    previewQueryIds: v.array(v.id("queries")),
    proposalId: v.id("proposals"),
  },
  handler: async (ctx, args) => {
    const proposal = await ctx.db.get("proposals", args.proposalId);
    if (
      !proposal ||
      proposal.linkedQuerySummaryGeneration !== args.generation ||
      proposal.linkedQuerySummaryState !== "reconciling"
    ) {
      return { isDone: false, processed: 0, stale: true };
    }
    const page = await ctx.db
      .query("proposalQueryLinks")
      .withIndex("by_proposalId", (query) => query.eq("proposalId", args.proposalId))
      .paginate({ cursor: args.cursor, numItems: RECONCILE_PAGE_SIZE });
    const previewQueryIds = [...args.previewQueryIds];
    for (const link of page.page) {
      if (
        previewQueryIds.length < PROPOSAL_LINKED_QUERY_PREVIEW_LIMIT &&
        !previewQueryIds.some((queryId) => String(queryId) === String(link.queryId))
      ) {
        previewQueryIds.push(link.queryId);
      }
    }
    const count = args.count + page.page.length;
    if (!page.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.crm.proposalRelationSummary.reconcileProposalRelationSummary,
        {
          count,
          cursor: page.continueCursor,
          generation: args.generation,
          previewQueryIds,
          proposalId: args.proposalId,
        }
      );
      return { isDone: false, processed: page.page.length, stale: false };
    }
    const previewQueries = compactPageItems(
      await mapInBoundedBatches(
        previewQueryIds,
        async (queryId) => await ctx.db.get("queries", queryId)
      )
    );
    await ctx.db.patch("proposals", proposal._id, {
      linkedQueryCount: count,
      linkedQueryPreview: previewQueries.map(storedProposalQueryProjection),
      linkedQuerySummaryState: "ready",
      linkedQuerySummaryVersion: PROPOSAL_LINKED_QUERY_SUMMARY_VERSION,
    });
    return { isDone: true, processed: page.page.length, stale: false };
  },
  returns: v.object({
    isDone: v.boolean(),
    processed: v.number(),
    stale: v.boolean(),
  }),
});

export const reconcileProposalRelationSummaryPage = internalMutation({
  args: { cursor: v.union(v.string(), v.null()), generation: v.number() },
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("proposals")
      .withIndex("by_createdAt")
      .paginate({ cursor: args.cursor, numItems: RECONCILE_PAGE_SIZE });
    const pending = page.page.filter(
      (proposal) =>
        proposal.linkedQuerySummaryState !== "ready" ||
        proposal.linkedQuerySummaryVersion !== PROPOSAL_LINKED_QUERY_SUMMARY_VERSION
    );
    await mapInBoundedBatches(pending, async (proposal) => {
      await ctx.db.patch("proposals", proposal._id, {
        linkedQuerySummaryGeneration: args.generation,
        linkedQuerySummaryState: "reconciling",
        linkedQuerySummaryVersion: PROPOSAL_LINKED_QUERY_SUMMARY_VERSION,
      });
      await ctx.scheduler.runAfter(
        0,
        internal.crm.proposalRelationSummary.reconcileProposalRelationSummary,
        {
          count: 0,
          cursor: null,
          generation: args.generation,
          previewQueryIds: proposal.queryId ? [proposal.queryId] : [],
          proposalId: proposal._id,
        }
      );
    });
    if (!page.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.crm.proposalRelationSummary.reconcileProposalRelationSummaryPage,
        { cursor: page.continueCursor, generation: args.generation }
      );
    }
    return { isDone: page.isDone, scheduled: pending.length };
  },
  returns: v.object({ isDone: v.boolean(), scheduled: v.number() }),
});

export const reconcileAll = internalMutation({
  args: {},
  handler: async (ctx) => {
    const generation = Date.now();
    await ctx.scheduler.runAfter(
      0,
      internal.crm.proposalRelationSummary.reconcileProposalRelationSummaryPage,
      { cursor: null, generation }
    );
    return { generation };
  },
  returns: v.object({ generation: v.number() }),
});
