import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { CommercialFileSourceType } from "./commercialFilePolicy";

type CommercialFileChainCtx = Pick<QueryCtx | MutationCtx, "db">;

function queryChainKey(queryId: Id<"queries">) {
  return `query:${String(queryId)}`;
}

function proposalChainKey(proposalId: Id<"proposals">, queryId?: Id<"queries">) {
  return queryId ? queryChainKey(queryId) : `proposal:${String(proposalId)}`;
}

/**
 * Resolve the stable root used by new Commercial File registry rows.
 *
 * Query is the canonical root of the existing Query -> Proposal -> Job Card
 * model. Proposals and Job Cards keep their explicit primary Query when one is
 * present. Unlinked records retain a typed self-root instead of guessing a
 * relationship from labels or presentation fields.
 */
export async function resolveCommercialFileChainKey(
  ctx: CommercialFileChainCtx,
  sourceType: CommercialFileSourceType,
  sourceId: string
) {
  if (sourceType === "query") {
    const queryId = ctx.db.normalizeId("queries", sourceId);
    const query = queryId ? await ctx.db.get("queries", queryId) : null;
    return query ? queryChainKey(query._id) : null;
  }

  if (sourceType === "proposal") {
    const proposalId = ctx.db.normalizeId("proposals", sourceId);
    const proposal = proposalId ? await ctx.db.get("proposals", proposalId) : null;
    if (!proposal) {
      return null;
    }
    return proposalChainKey(proposal._id, proposal.queryId);
  }

  const jobCardId = ctx.db.normalizeId("jobCards", sourceId);
  const jobCard = jobCardId ? await ctx.db.get("jobCards", jobCardId) : null;
  if (!jobCard) {
    return null;
  }
  if (jobCard.queryId) {
    return queryChainKey(jobCard.queryId);
  }
  if (jobCard.proposalId) {
    const proposal = await ctx.db.get("proposals", jobCard.proposalId);
    if (proposal?.queryId) {
      return queryChainKey(proposal.queryId);
    }
    return `proposal:${String(jobCard.proposalId)}`;
  }
  return `jobCard:${String(jobCard._id)}`;
}

// Keep file access aligned in the same transaction as the relationship edit.
// ponytail: source-scoped collections share Convex's transaction ceiling; use a
// staged rekey if measured source sizes approach that ceiling.
export async function rekeyCommercialFilesForProposalRelationship(
  ctx: MutationCtx,
  proposalId: Id<"proposals">,
  previousQueryId?: Id<"queries">,
  nextQueryId?: Id<"queries">
) {
  const previousChainKey = proposalChainKey(proposalId, previousQueryId);
  const nextChainKey = proposalChainKey(proposalId, nextQueryId);
  if (previousChainKey === nextChainKey) {
    return;
  }

  const proposalRows = await ctx.db
    .query("commercialFiles")
    .withIndex("by_source", (q) =>
      q.eq("sourceType", "proposal").eq("sourceId", String(proposalId))
    )
    .collect();

  const jobCards = await ctx.db
    .query("jobCards")
    .withIndex("by_proposalId", (q) => q.eq("proposalId", proposalId))
    .collect();
  const inheritedRows = (
    await Promise.all(
      jobCards
        .filter((jobCard) => !jobCard.queryId)
        .map((jobCard) =>
          ctx.db
            .query("commercialFiles")
            .withIndex("by_source", (q) =>
              q.eq("sourceType", "jobCard").eq("sourceId", String(jobCard._id))
            )
            .collect()
        )
    )
  ).flat();
  await Promise.all(
    [...proposalRows, ...inheritedRows].map((row) =>
      ctx.db.patch("commercialFiles", row._id, { chainKey: nextChainKey })
    )
  );
}
