import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { scheduleCrmMetricSync } from "./financeMetricSync";
import { canSeeQueryRecord, type PortalAccess } from "./lib";
import { insertWithE2eOwnership, patchWithE2eOwnership } from "./lib/e2eOwnership";
import { proposalLinkedQuerySummary, proposalLinkProjection } from "./proposalLinkProjection";
import { deleteMiceDocDraftsForPair } from "./proposalMiceDoc";

type ProposalRelationCtx = MutationCtx | QueryCtx;

export const PROPOSAL_LIFECYCLE_RETENTION_MESSAGE =
  "Cannot delete this Proposal because its immutable sales handoff, decision, and revision history must be retained.";

function hasLegacyLifecycleMarker(link: Doc<"proposalQueryLinks">) {
  return (
    link.handedOffAt !== undefined ||
    link.handedOffRevision !== undefined ||
    link.decisionAt !== undefined ||
    link.decisionDigest !== undefined ||
    link.decisionRevision !== undefined ||
    link.decisionStatus !== undefined ||
    link.revisionRequestedAt !== undefined
  );
}

type ProposalLifecycleMarker = Pick<
  Doc<"proposals">,
  "sentAt" | "sentToClientAt" | "sentToSalesAt" | "status"
>;

function hasProposalLifecycleMarker(proposal: ProposalLifecycleMarker) {
  return (
    proposal.sentToSalesAt !== undefined ||
    (proposal.sentToClientAt === undefined && proposal.sentAt !== undefined)
  );
}

export async function assertProposalLifecycleCanBeRemoved(
  ctx: ProposalRelationCtx,
  proposalId: Id<"proposals">,
  options: {
    links: readonly Doc<"proposalQueryLinks">[];
    queryId?: Id<"queries">;
  }
) {
  if (options.links.some(hasLegacyLifecycleMarker)) {
    throw new ConvexError(PROPOSAL_LIFECYCLE_RETENTION_MESSAGE);
  }
  const { queryId } = options;
  const [handoff, decision, revisionRequest] = await Promise.all([
    queryId
      ? ctx.db
          .query("proposalQueryHandoffs")
          .withIndex("by_proposalId_queryId_revision", (q) =>
            q.eq("proposalId", proposalId).eq("queryId", queryId)
          )
          .first()
      : ctx.db
          .query("proposalQueryHandoffs")
          .withIndex("by_proposalId_queryId_revision", (q) => q.eq("proposalId", proposalId))
          .first(),
    queryId
      ? ctx.db
          .query("proposalQueryDecisions")
          .withIndex("by_proposalId_queryId_decidedAt", (q) =>
            q.eq("proposalId", proposalId).eq("queryId", queryId)
          )
          .first()
      : ctx.db
          .query("proposalQueryDecisions")
          .withIndex("by_proposalId_queryId_decidedAt", (q) => q.eq("proposalId", proposalId))
          .first(),
    queryId
      ? ctx.db
          .query("proposalRevisionRequests")
          .withIndex("by_proposalId_queryId_requestedAt", (q) =>
            q.eq("proposalId", proposalId).eq("queryId", queryId)
          )
          .first()
      : ctx.db
          .query("proposalRevisionRequests")
          .withIndex("by_proposalId_queryId_requestedAt", (q) => q.eq("proposalId", proposalId))
          .first(),
  ]);
  if (handoff || decision || revisionRequest) {
    throw new ConvexError(PROPOSAL_LIFECYCLE_RETENTION_MESSAGE);
  }
}

export function mergeProposalLinkedQueriesForUpdate(
  access: PortalAccess,
  currentLinkedQueries: Doc<"queries">[],
  requestedLinkedQueries: Doc<"queries">[]
) {
  return Array.from(
    new Map(
      [
        ...requestedLinkedQueries,
        ...currentLinkedQueries.filter((linkedQuery) => !canSeeQueryRecord(access, linkedQuery)),
      ].map((linkedQuery) => [String(linkedQuery._id), linkedQuery])
    ).values()
  );
}

export async function resolveLinkedQueries(
  ctx: MutationCtx,
  access: PortalAccess,
  queryIdStrings: string[]
) {
  const normalizedIds: Id<"queries">[] = [];
  const seen = new Set<string>();
  for (const value of queryIdStrings) {
    if (!value) {
      continue;
    }
    const queryId = ctx.db.normalizeId("queries", value);
    if (!queryId) {
      throw new ConvexError("Invalid query id");
    }
    if (seen.has(String(queryId))) {
      continue;
    }
    seen.add(String(queryId));
    normalizedIds.push(queryId);
  }

  return await Promise.all(
    normalizedIds.map(async (queryId) => {
      const linkedQuery = await ctx.db.get("queries", queryId);
      if (!linkedQuery) {
        throw new ConvexError("Linked query not found");
      }
      if (!canSeeQueryRecord(access, linkedQuery)) {
        throw new ConvexError("FORBIDDEN");
      }
      return linkedQuery;
    })
  );
}

export async function proposalQueryLinks(ctx: ProposalRelationCtx, proposalId: Id<"proposals">) {
  return await ctx.db
    .query("proposalQueryLinks")
    .withIndex("by_proposalId", (query) => query.eq("proposalId", proposalId))
    .collect();
}

export async function linkedQueriesForProposal(
  ctx: ProposalRelationCtx,
  proposal: Pick<Doc<"proposals">, "_id" | "queryId">
) {
  const links = await proposalQueryLinks(ctx, proposal._id);
  const queryIds = new Set<Id<"queries">>();
  if (proposal.queryId) {
    queryIds.add(proposal.queryId);
  }
  for (const link of links) {
    queryIds.add(link.queryId);
  }

  const linkedQueries = await Promise.all(
    Array.from(queryIds, (queryId) => ctx.db.get("queries", queryId))
  );
  return linkedQueries.filter((linkedQuery): linkedQuery is Doc<"queries"> => linkedQuery !== null);
}

export async function syncProposalQueryLinks(
  ctx: MutationCtx,
  proposalId: Id<"proposals">,
  linkedQueries: Doc<"queries">[],
  createdBy: string,
  previousProposal?: ProposalLifecycleMarker & { queryId?: Id<"queries"> }
) {
  const existingLinks = await proposalQueryLinks(ctx, proposalId);
  const queryById = new Map(
    linkedQueries.map((linkedQuery) => [String(linkedQuery._id), linkedQuery])
  );
  const removedLinks = existingLinks.filter((link) => !queryById.has(String(link.queryId)));
  const lifecycleChecks = removedLinks.map((link) =>
    assertProposalLifecycleCanBeRemoved(ctx, proposalId, {
      links: [link],
      queryId: link.queryId,
    })
  );
  const previousPrimaryQueryId = previousProposal?.queryId;
  if (
    previousPrimaryQueryId &&
    !queryById.has(String(previousPrimaryQueryId)) &&
    hasProposalLifecycleMarker(previousProposal)
  ) {
    throw new ConvexError(PROPOSAL_LIFECYCLE_RETENTION_MESSAGE);
  }
  if (
    previousPrimaryQueryId &&
    !queryById.has(String(previousPrimaryQueryId)) &&
    !removedLinks.some((link) => link.queryId === previousPrimaryQueryId)
  ) {
    lifecycleChecks.push(
      assertProposalLifecycleCanBeRemoved(ctx, proposalId, {
        links: [],
        queryId: previousPrimaryQueryId,
      })
    );
  }
  await Promise.all(lifecycleChecks);
  await Promise.all(
    existingLinks.map((link) => {
      const linkedQuery = queryById.get(String(link.queryId));
      return linkedQuery
        ? patchWithE2eOwnership(
            ctx,
            "proposalQueryLinks",
            link._id,
            proposalLinkProjection(linkedQuery)
          )
        : Promise.all([
            deleteMiceDocDraftsForPair(ctx, proposalId, link.queryId),
            ctx.db.delete("proposalQueryLinks", link._id),
          ]);
    })
  );

  const existing = new Set(existingLinks.map((link) => String(link.queryId)));
  const now = Date.now();
  await Promise.all(
    linkedQueries.map(async (linkedQuery) => {
      if (existing.has(String(linkedQuery._id))) {
        return;
      }
      await insertWithE2eOwnership(ctx, "proposalQueryLinks", {
        ...proposalLinkProjection(linkedQuery),
        createdAt: now,
        createdBy,
        proposalId,
        queryId: linkedQuery._id,
      });
    })
  );
  await patchWithE2eOwnership(
    ctx,
    "proposals",
    proposalId,
    proposalLinkedQuerySummary(linkedQueries)
  );
  await scheduleCrmMetricSync(ctx, "proposals", String(proposalId));
  return Array.from(
    new Set([
      ...existingLinks.map((link) => String(link.queryId)),
      ...linkedQueries.map((linkedQuery) => String(linkedQuery._id)),
    ])
  );
}

export async function deleteProposalQueryLinks(ctx: MutationCtx, proposal: Doc<"proposals">) {
  if (hasProposalLifecycleMarker(proposal)) {
    throw new ConvexError(PROPOSAL_LIFECYCLE_RETENTION_MESSAGE);
  }
  const proposalId = proposal._id;
  const links = await proposalQueryLinks(ctx, proposalId);
  await assertProposalLifecycleCanBeRemoved(ctx, proposalId, { links });
  await Promise.all(links.map((link) => ctx.db.delete("proposalQueryLinks", link._id)));
}
