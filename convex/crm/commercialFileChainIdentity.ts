import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { CommercialFileSourceType } from "./commercialFilePolicy";

type CommercialFileChainCtx = Pick<QueryCtx | MutationCtx, "db">;
const MAX_RELATIONSHIP_REKEY_FILES = 100;
const MAX_RELATIONSHIP_REKEY_JOB_CARDS = 25;

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

async function inheritedJobCardFileRows(
  ctx: MutationCtx,
  jobCards: Doc<"jobCards">[],
  index: number,
  remaining: number,
  rows: Doc<"commercialFiles">[]
): Promise<Doc<"commercialFiles">[]> {
  if (index >= jobCards.length) {
    return rows;
  }
  const jobCard = jobCards[index];
  if (!jobCard || jobCard.queryId) {
    return await inheritedJobCardFileRows(ctx, jobCards, index + 1, remaining, rows);
  }
  const sourceRows = await ctx.db
    .query("commercialFiles")
    .withIndex("by_source", (q) =>
      q.eq("sourceType", "jobCard").eq("sourceId", String(jobCard._id))
    )
    .take(remaining + 1);
  if (sourceRows.length > remaining) {
    throw new ConvexError("Commercial File relationship rekey exceeds its bounded file limit");
  }
  return await inheritedJobCardFileRows(ctx, jobCards, index + 1, remaining - sourceRows.length, [
    ...rows,
    ...sourceRows,
  ]);
}

/**
 * Keep new canonical rows aligned when a Proposal's exact primary Query pair
 * changes. The ordinary writer is fail-closed and transactionally bounded; it
 * is not a target migration or compatibility cutover.
 */
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
    .take(MAX_RELATIONSHIP_REKEY_FILES + 1);
  if (proposalRows.length > MAX_RELATIONSHIP_REKEY_FILES) {
    throw new ConvexError("Commercial File relationship rekey exceeds its bounded file limit");
  }

  const jobCards = await ctx.db
    .query("jobCards")
    .withIndex("by_proposalId", (q) => q.eq("proposalId", proposalId))
    .take(MAX_RELATIONSHIP_REKEY_JOB_CARDS + 1);
  if (jobCards.length > MAX_RELATIONSHIP_REKEY_JOB_CARDS) {
    throw new ConvexError("Commercial File relationship rekey exceeds its bounded source limit");
  }
  const inheritedRows = await inheritedJobCardFileRows(
    ctx,
    jobCards,
    0,
    MAX_RELATIONSHIP_REKEY_FILES - proposalRows.length,
    []
  );
  await Promise.all(
    [...proposalRows, ...inheritedRows].map((row) =>
      ctx.db.patch("commercialFiles", row._id, { chainKey: nextChainKey })
    )
  );
}
