import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { mapInBoundedBatches } from "./paginationPolicy";

const PROJECTION_TABLE = "proposalQueryLinks";
const PROJECTION_VERSION = 1;
const RECONCILE_PAGE_SIZE = 50;
const RECONCILE_STALE_MS = 60 * 60 * 1000;

export function proposalLinkProjection(query: Doc<"queries">) {
  return {
    clientName: query.clientName,
    contractingOwnerId: query.contractingOwnerId ?? "",
    contractingOwnerName: query.contractingOwnerName ?? "",
    contractingStatus: query.contractingStatus,
    paxCount: query.paxCount ?? 0,
    queryCode: query.queryCode,
    queryCreatedBy: query.createdBy,
    queryType: query.queryType,
    salesOwnerId: query.salesOwnerId ?? "",
    salesOwnerName: query.salesOwnerName ?? "",
    salesStatus: query.salesStatus,
    ticketingOwnerId: query.ticketingOwnerId ?? "",
    ticketingOwnerName: query.ticketingOwnerName ?? "",
    ticketingScope: query.ticketingScope ?? "",
  };
}

export function storedProposalQueryProjection(query: Doc<"queries">) {
  return {
    ...proposalLinkProjection(query),
    queryId: query._id,
  };
}

export function isProposalLinkProjectionComplete(link: Doc<"proposalQueryLinks">) {
  return (
    link.clientName !== undefined &&
    link.contractingStatus !== undefined &&
    link.paxCount !== undefined &&
    link.queryCode !== undefined &&
    link.queryCreatedBy !== undefined &&
    link.queryType !== undefined &&
    link.salesStatus !== undefined
  );
}

export function queryVisibilityFromProposalLink(
  link: Doc<"proposalQueryLinks"> | ReturnType<typeof storedProposalQueryProjection>
) {
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
  const query = await ctx.db.get(queryId);
  if (!query) {
    return 0;
  }
  const links = await ctx.db
    .query("proposalQueryLinks")
    .withIndex("by_queryId", (builder) => builder.eq("queryId", queryId))
    .collect();
  const projection = proposalLinkProjection(query);
  await mapInBoundedBatches(links, async (link) => await ctx.db.patch(link._id, projection));
  const proposalIds = Array.from(new Set(links.map((link) => String(link.proposalId))));
  await mapInBoundedBatches(proposalIds, async (proposalIdString) => {
    const proposalId = ctx.db.normalizeId("proposals", proposalIdString);
    const proposal = proposalId ? await ctx.db.get(proposalId) : null;
    if (!proposal) {
      return;
    }
    const current = proposal.linkedQueryProjection ?? [];
    await ctx.db.patch(proposal._id, {
      linkedQueryProjection: [
        ...current.filter((entry) => String(entry.queryId) !== String(queryId)),
        storedProposalQueryProjection(query),
      ],
    });
  });
  return links.length;
}

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
    const projectionsByProposal = new Map<
      string,
      ReturnType<typeof storedProposalQueryProjection>[]
    >();
    for (const { link, query } of hydratedLinks) {
      const key = String(link.proposalId);
      const current = projectionsByProposal.get(key) ?? [];
      current.push(storedProposalQueryProjection(query));
      projectionsByProposal.set(key, current);
    }
    await mapInBoundedBatches(
      Array.from(projectionsByProposal),
      async ([proposalIdString, projections]) => {
        const proposalId = ctx.db.normalizeId("proposals", proposalIdString);
        const proposal = proposalId ? await ctx.db.get(proposalId) : null;
        if (!proposal) {
          return;
        }
        const updatedIds = new Set(projections.map((projection) => String(projection.queryId)));
        await ctx.db.patch(proposal._id, {
          linkedQueryProjection: [
            ...(proposal.linkedQueryProjection ?? []).filter(
              (projection) => !updatedIds.has(String(projection.queryId))
            ),
            ...projections,
          ],
        });
      }
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
});
