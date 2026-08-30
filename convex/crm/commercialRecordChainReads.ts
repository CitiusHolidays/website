import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { query } from "../_generated/server";
import {
  dedupeCommercialChainFiles,
  mapProposalCommercialFiles,
  mapQueryCommercialFiles,
} from "./commercialRecordChain";
import {
  canSeeJobCardRecord,
  canSeeProposalRecord,
  canSeeQueryRecord,
  PERMISSIONS,
  requireAnyPermission,
} from "./lib";

const commercialChainFileValidator = v.object({
  attachmentId: v.string(),
  createdAt: v.number(),
  fileKind: v.union(v.literal("attachment"), v.literal("proposalDoc")),
  fileName: v.string(),
  fileSize: v.number(),
  mimeType: v.string(),
  readOnly: v.boolean(),
  sourceCode: v.string(),
  sourceId: v.string(),
  sourceLabel: v.string(),
  sourceType: v.union(v.literal("query"), v.literal("proposal")),
  storageId: v.string(),
});

type EntryPoint = "query" | "proposal" | "jobCard";
const MAX_COMMERCIAL_CHAIN_SOURCES = 100;

function assertBoundedChainRows<Row>(rows: Row[], label: string) {
  if (rows.length > MAX_COMMERCIAL_CHAIN_SOURCES) {
    throw new ConvexError(`${label} exceeds the bounded Commercial File chain limit`);
  }
  return rows;
}

export async function primaryQueryForProposal(
  ctx: QueryCtx,
  proposal: { _id: Id<"proposals">; queryId?: Id<"queries"> }
) {
  if (!proposal.queryId) {
    return null;
  }
  return await ctx.db.get("queries", proposal.queryId);
}

export async function proposalsForQuery(
  ctx: QueryCtx,
  queryId: Id<"queries">,
  limit = MAX_COMMERCIAL_CHAIN_SOURCES
) {
  return assertBoundedChainRows(
    await ctx.db
      .query("proposals")
      .withIndex("by_queryId", (q) => q.eq("queryId", queryId))
      .take(limit + 1),
    "Proposal set"
  );
}

export async function resolveCommercialChain(
  ctx: QueryCtx,
  entryPoint: EntryPoint,
  entityId: string
) {
  const queries = new Map<string, NonNullable<Awaited<ReturnType<typeof ctx.db.get<"queries">>>>>();
  const proposals = new Map<
    string,
    NonNullable<Awaited<ReturnType<typeof ctx.db.get<"proposals">>>>
  >();
  const jobCards = new Map<
    string,
    NonNullable<Awaited<ReturnType<typeof ctx.db.get<"jobCards">>>>
  >();
  let relationshipRowsRead = 0;

  const remainingRelationshipRows = () => MAX_COMMERCIAL_CHAIN_SOURCES - relationshipRowsRead;
  const reserveRelationshipRows = <Row>(rows: Row[], label: string) => {
    const remaining = remainingRelationshipRows();
    if (rows.length > remaining) {
      throw new ConvexError(`${label} exceeds the bounded Commercial File chain limit`);
    }
    relationshipRowsRead += rows.length;
    return rows;
  };

  const reserveSource = (exists: boolean, label: string) => {
    if (exists) {
      return false;
    }
    if (queries.size + proposals.size + jobCards.size >= MAX_COMMERCIAL_CHAIN_SOURCES) {
      throw new ConvexError(`${label} exceeds the bounded Commercial File chain limit`);
    }
    return true;
  };

  const addProposal = async (
    proposal: NonNullable<Awaited<ReturnType<typeof ctx.db.get<"proposals">>>>,
    queryId?: Id<"queries">
  ) => {
    if (!reserveSource(proposals.has(String(proposal._id)), "Commercial File source set")) {
      return;
    }
    proposals.set(String(proposal._id), proposal);
    const remaining = remainingRelationshipRows();
    const proposalJobCards = reserveRelationshipRows(
      await ctx.db
        .query("jobCards")
        .withIndex("by_proposalId", (q) => q.eq("proposalId", proposal._id))
        .take(remaining + 1),
      "Proposal Job Card set"
    );
    for (const jobCard of proposalJobCards) {
      const belongsToPair = queryId
        ? String(jobCard.queryId ?? proposal.queryId ?? "") === String(queryId)
        : !jobCard.queryId;
      if (
        belongsToPair &&
        reserveSource(jobCards.has(String(jobCard._id)), "Commercial File source set")
      ) {
        jobCards.set(String(jobCard._id), jobCard);
      }
    }
  };

  const addProposals = async (
    rows: NonNullable<Awaited<ReturnType<typeof ctx.db.get<"proposals">>>>[],
    index: number,
    queryId: Id<"queries">
  ): Promise<void> => {
    const proposal = rows[index];
    if (!proposal) {
      return;
    }
    await addProposal(proposal, queryId);
    await addProposals(rows, index + 1, queryId);
  };

  const addQuery = async (
    queryRow: NonNullable<Awaited<ReturnType<typeof ctx.db.get<"queries">>>>
  ) => {
    if (!reserveSource(queries.has(String(queryRow._id)), "Commercial File source set")) {
      return;
    }
    queries.set(String(queryRow._id), queryRow);
    let remaining = remainingRelationshipRows();
    const queryJobCards = reserveRelationshipRows(
      await ctx.db
        .query("jobCards")
        .withIndex("by_queryId", (q) => q.eq("queryId", queryRow._id))
        .take(remaining + 1),
      "Query Job Card set"
    );
    for (const jobCard of queryJobCards) {
      if (reserveSource(jobCards.has(String(jobCard._id)), "Commercial File source set")) {
        jobCards.set(String(jobCard._id), jobCard);
      }
    }
    remaining = remainingRelationshipRows();
    const queryProposals = reserveRelationshipRows(
      await proposalsForQuery(ctx, queryRow._id, remaining),
      "Proposal set"
    );
    await addProposals(queryProposals, 0, queryRow._id);
  };

  const resolveFromQuery = async () => {
    const queryId = ctx.db.normalizeId("queries", entityId);
    if (!queryId) {
      return;
    }
    const queryRow = await ctx.db.get("queries", queryId);
    if (queryRow) {
      await addQuery(queryRow);
    }
  };

  const resolveFromProposal = async () => {
    const proposalId = ctx.db.normalizeId("proposals", entityId);
    if (!proposalId) {
      return;
    }
    const proposal = await ctx.db.get("proposals", proposalId);
    if (proposal) {
      const primaryQuery = await primaryQueryForProposal(ctx, proposal);
      if (primaryQuery) {
        await addQuery(primaryQuery);
        await addProposal(proposal, primaryQuery._id);
      } else {
        await addProposal(proposal);
      }
    }
  };

  const addJobCardRelations = async (
    jobCard: NonNullable<Awaited<ReturnType<typeof ctx.db.get<"jobCards">>>>
  ) => {
    if (jobCard.queryId) {
      const queryRow = await ctx.db.get("queries", jobCard.queryId);
      if (queryRow) {
        await addQuery(queryRow);
      }
      return;
    }
    if (!jobCard.proposalId) {
      return;
    }
    const proposal = await ctx.db.get("proposals", jobCard.proposalId);
    if (!proposal) {
      return;
    }
    const primaryQuery = await primaryQueryForProposal(ctx, proposal);
    if (primaryQuery) {
      await addQuery(primaryQuery);
      await addProposal(proposal, primaryQuery._id);
      return;
    }
    await addProposal(proposal);
  };

  const resolveFromJobCard = async () => {
    const jobCardId = ctx.db.normalizeId("jobCards", entityId);
    if (!jobCardId) {
      return;
    }
    const jobCard = await ctx.db.get("jobCards", jobCardId);
    if (!jobCard) {
      return;
    }
    if (reserveSource(jobCards.has(String(jobCard._id)), "Commercial File source set")) {
      jobCards.set(String(jobCard._id), jobCard);
    }
    await addJobCardRelations(jobCard);
  };

  if (entryPoint === "query") {
    await resolveFromQuery();
  } else if (entryPoint === "proposal") {
    await resolveFromProposal();
  } else {
    await resolveFromJobCard();
  }

  return { jobCards, proposals, queries };
}

async function loadQueryCommercialFiles(
  ctx: QueryCtx,
  queryRow: NonNullable<Awaited<ReturnType<typeof ctx.db.get<"queries">>>>,
  entryPoint: EntryPoint,
  entryEntityId: string
) {
  const attachments = await ctx.db
    .query("queryAttachments")
    .withIndex("by_queryId_createdAt", (q) => q.eq("queryId", queryRow._id))
    .collect();
  return mapQueryCommercialFiles(
    queryRow,
    attachments,
    !(entryPoint === "query" && entryEntityId === String(queryRow._id))
  );
}

async function loadProposalCommercialFiles(
  ctx: QueryCtx,
  proposal: NonNullable<Awaited<ReturnType<typeof ctx.db.get<"proposals">>>>,
  entryPoint: EntryPoint,
  entryEntityId: string
) {
  const attachments = await ctx.db
    .query("proposalAttachments")
    .withIndex("by_proposalId", (q) => q.eq("proposalId", proposal._id))
    .collect();
  return mapProposalCommercialFiles(
    proposal,
    attachments,
    !(entryPoint === "proposal" && entryEntityId === String(proposal._id))
  );
}

export async function loadCommercialChainFilesForEntryPoint(
  ctx: QueryCtx,
  entryPoint: EntryPoint,
  entityId: string
) {
  const chain = await resolveCommercialChain(ctx, entryPoint, entityId);
  const [queryFiles, proposalFiles] = await Promise.all([
    Promise.all(
      Array.from(chain.queries.values(), (queryRow) =>
        loadQueryCommercialFiles(ctx, queryRow, entryPoint, entityId)
      )
    ),
    Promise.all(
      Array.from(chain.proposals.values(), (proposal) =>
        loadProposalCommercialFiles(ctx, proposal, entryPoint, entityId)
      )
    ),
  ]);
  const files = [...queryFiles.flat(), ...proposalFiles.flat()];
  return dedupeCommercialChainFiles(files);
}

export const listForEntryPoint = query({
  args: {
    entityId: v.string(),
    entryPoint: v.union(v.literal("query"), v.literal("proposal"), v.literal("jobCard")),
  },
  handler: async (ctx, args) => {
    const access = await requireAnyPermission(ctx, [
      PERMISSIONS.VIEW_QUERIES,
      PERMISSIONS.VIEW_CONTRACTING,
      PERMISSIONS.VIEW_PROPOSALS,
      PERMISSIONS.VIEW_JOB_CARDS,
    ]);
    const chain = await resolveCommercialChain(ctx, args.entryPoint, args.entityId);
    let canSeeEntryPoint = false;
    if (args.entryPoint === "query") {
      const queryId = ctx.db.normalizeId("queries", args.entityId);
      const queryRow = queryId ? await ctx.db.get("queries", queryId) : null;
      canSeeEntryPoint = Boolean(queryRow && canSeeQueryRecord(access, queryRow));
    } else if (args.entryPoint === "proposal") {
      const proposalId = ctx.db.normalizeId("proposals", args.entityId);
      const proposal = proposalId ? await ctx.db.get("proposals", proposalId) : null;
      const primaryQuery = proposal?.queryId
        ? chain.queries.get(String(proposal.queryId))
        : undefined;
      canSeeEntryPoint = Boolean(proposal && canSeeProposalRecord(access, proposal, primaryQuery));
    } else {
      const jobCardId = ctx.db.normalizeId("jobCards", args.entityId);
      const jobCard = jobCardId ? await ctx.db.get("jobCards", jobCardId) : null;
      const linkedQuery = jobCard?.queryId ? chain.queries.get(String(jobCard.queryId)) : null;
      canSeeEntryPoint = Boolean(
        jobCard && canSeeJobCardRecord(access, jobCard, linkedQuery ?? undefined)
      );
    }
    if (!canSeeEntryPoint) {
      return [];
    }

    const [queryFiles, proposalFiles] = await Promise.all([
      Promise.all(
        Array.from(chain.queries.values(), (queryRow) =>
          loadQueryCommercialFiles(ctx, queryRow, args.entryPoint, args.entityId)
        )
      ),
      Promise.all(
        Array.from(chain.proposals.values(), (proposal) =>
          loadProposalCommercialFiles(ctx, proposal, args.entryPoint, args.entityId)
        )
      ),
    ]);
    const files = [...queryFiles.flat(), ...proposalFiles.flat()];
    return dedupeCommercialChainFiles(files);
  },
  returns: v.array(commercialChainFileValidator),
});
