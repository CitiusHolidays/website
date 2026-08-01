import { v } from "convex/values";
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

export async function linkedQueriesForProposal(
  ctx: QueryCtx,
  proposal: { _id: Id<"proposals">; queryId?: Id<"queries"> }
) {
  const links = await ctx.db
    .query("proposalQueryLinks")
    .withIndex("by_proposalId", (q) => q.eq("proposalId", proposal._id))
    .collect();
  const queryIds = new Set<Id<"queries">>();
  if (proposal.queryId) {
    queryIds.add(proposal.queryId);
  }
  for (const link of links) {
    queryIds.add(link.queryId);
  }
  return (await Promise.all(Array.from(queryIds, (queryId) => ctx.db.get(queryId)))).filter(
    (row): row is NonNullable<typeof row> => row !== null
  );
}

export async function proposalsForQuery(ctx: QueryCtx, queryId: Id<"queries">) {
  const proposalIds = new Set<Id<"proposals">>();
  const direct = await ctx.db
    .query("proposals")
    .withIndex("by_queryId", (q) => q.eq("queryId", queryId))
    .collect();
  for (const proposal of direct) {
    proposalIds.add(proposal._id);
  }
  const links = await ctx.db
    .query("proposalQueryLinks")
    .withIndex("by_queryId", (q) => q.eq("queryId", queryId))
    .collect();
  for (const link of links) {
    proposalIds.add(link.proposalId);
  }
  return (
    await Promise.all(Array.from(proposalIds, (proposalId) => ctx.db.get(proposalId)))
  ).filter((row): row is NonNullable<typeof row> => row !== null);
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

  const addQuery = async (
    queryRow: NonNullable<Awaited<ReturnType<typeof ctx.db.get<"queries">>>>
  ) => {
    queries.set(String(queryRow._id), queryRow);
    for (const jobCard of await ctx.db
      .query("jobCards")
      .withIndex("by_queryId", (q) => q.eq("queryId", queryRow._id))
      .collect()) {
      jobCards.set(String(jobCard._id), jobCard);
    }
  };

  const addProposal = async (
    proposal: NonNullable<Awaited<ReturnType<typeof ctx.db.get<"proposals">>>>
  ) => {
    proposals.set(String(proposal._id), proposal);
    await Promise.all(
      (await linkedQueriesForProposal(ctx, proposal)).map((queryRow) => addQuery(queryRow))
    );
    for (const jobCard of await ctx.db
      .query("jobCards")
      .withIndex("by_proposalId", (q) => q.eq("proposalId", proposal._id))
      .collect()) {
      jobCards.set(String(jobCard._id), jobCard);
    }
  };

  if (entryPoint === "query") {
    const queryId = ctx.db.normalizeId("queries", entityId);
    if (!queryId) {
      return { jobCards, proposals, queries };
    }
    const queryRow = await ctx.db.get(queryId);
    if (queryRow) {
      await addQuery(queryRow);
      await Promise.all(
        (await proposalsForQuery(ctx, queryId)).map((proposal) => addProposal(proposal))
      );
    }
  }

  if (entryPoint === "proposal") {
    const proposalId = ctx.db.normalizeId("proposals", entityId);
    if (!proposalId) {
      return { jobCards, proposals, queries };
    }
    const proposal = await ctx.db.get(proposalId);
    if (proposal) {
      await addProposal(proposal);
    }
  }

  if (entryPoint === "jobCard") {
    const jobCardId = ctx.db.normalizeId("jobCards", entityId);
    if (!jobCardId) {
      return { jobCards, proposals, queries };
    }
    const jobCard = await ctx.db.get(jobCardId);
    if (!jobCard) {
      return { jobCards, proposals, queries };
    }
    jobCards.set(String(jobCard._id), jobCard);
    if (jobCard.queryId) {
      const queryRow = await ctx.db.get(jobCard.queryId);
      if (queryRow) {
        await addQuery(queryRow);
        await Promise.all(
          (await proposalsForQuery(ctx, jobCard.queryId)).map((proposal) => addProposal(proposal))
        );
      }
    }
    if (jobCard.proposalId) {
      const proposal = await ctx.db.get(jobCard.proposalId);
      if (proposal) {
        await addProposal(proposal);
      }
    }
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
      const queryRow = queryId ? await ctx.db.get(queryId) : null;
      canSeeEntryPoint = Boolean(queryRow && canSeeQueryRecord(access, queryRow));
    } else if (args.entryPoint === "proposal") {
      const proposalId = ctx.db.normalizeId("proposals", args.entityId);
      const proposal = proposalId ? await ctx.db.get(proposalId) : null;
      canSeeEntryPoint = Boolean(
        proposal &&
          canSeeProposalRecord(access, proposal, await linkedQueriesForProposal(ctx, proposal))
      );
    } else {
      const jobCardId = ctx.db.normalizeId("jobCards", args.entityId);
      const jobCard = jobCardId ? await ctx.db.get(jobCardId) : null;
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
