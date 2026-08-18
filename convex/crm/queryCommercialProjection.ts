import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { scheduleCrmMetricSync } from "./financeMetricSync";
import { insertWithE2eOwnership, patchWithE2eOwnership } from "./lib/e2eOwnership";
import { mapInBoundedBatches } from "./paginationPolicy";

const PROJECTION_KEY = "queries";
export const QUERY_COMMERCIAL_PROJECTION_VERSION = 3;
const RECONCILE_PAGE_SIZE = 50;
const STALE_AFTER_MS = 60 * 60 * 1000;

type ProposalPreview = NonNullable<Doc<"queries">["proposalPreview"]>;
type DocumentCandidate = NonNullable<Doc<"queryCommercialProjectionWorkers">["bestDocument"]>;

function proposalPreview(
  proposal: Doc<"proposals">,
  handedOffRevision: number | undefined
): ProposalPreview {
  return {
    costPrice: proposal.costPrice ?? 0,
    handedOffRevision,
    proposalCode: proposal.proposalCode,
    proposalId: proposal._id,
    proposalRevision: proposal.proposalRevision ?? 1,
    status: proposal.status,
    updatedAt: proposal.updatedAt,
  };
}

function documentCandidate(proposal: Doc<"proposals">): DocumentCandidate | undefined {
  if (!(proposal.finalizedPdfStorageId && ["Accepted", "Sent"].includes(proposal.status))) {
    return;
  }
  return {
    fileName: proposal.finalizedPdfFileName ?? "proposal.pdf",
    proposalId: proposal._id,
    rank: proposal.status === "Accepted" ? 0 : 1,
    updatedAt: proposal.updatedAt,
    uploadedAt: proposal.finalizedPdfUploadedAt,
  };
}

export function selectLatestProposal(
  current: ProposalPreview | undefined,
  candidate: ProposalPreview
): ProposalPreview {
  if (!current) {
    return candidate;
  }
  if (candidate.updatedAt !== current.updatedAt) {
    return candidate.updatedAt > current.updatedAt ? candidate : current;
  }
  return String(candidate.proposalId) > String(current.proposalId) ? candidate : current;
}

export function selectProposalDocument(
  current: DocumentCandidate | undefined,
  candidate: DocumentCandidate | undefined
) {
  if (!candidate) {
    return current;
  }
  if (!current || candidate.rank !== current.rank) {
    return !current || candidate.rank < current.rank ? candidate : current;
  }
  const candidateUploadedAt = candidate.uploadedAt ?? candidate.updatedAt;
  const currentUploadedAt = current.uploadedAt ?? current.updatedAt;
  if (candidateUploadedAt !== currentUploadedAt) {
    return candidateUploadedAt > currentUploadedAt ? candidate : current;
  }
  if (candidate.updatedAt !== current.updatedAt) {
    return candidate.updatedAt > current.updatedAt ? candidate : current;
  }
  return String(candidate.proposalId) > String(current.proposalId) ? candidate : current;
}

async function readiness(ctx: MutationCtx) {
  return await ctx.db
    .query("queryCommercialProjectionReadiness")
    .withIndex("by_key", (query) => query.eq("key", PROJECTION_KEY))
    .unique();
}

async function scheduleWorker(
  ctx: MutationCtx,
  queryId: Id<"queries">,
  generation: number,
  owned: boolean
) {
  const existing = await ctx.db
    .query("queryCommercialProjectionWorkers")
    .withIndex("by_queryId", (query) => query.eq("queryId", queryId))
    .unique();
  const workerPatch = {
    bestAcceptedProposal: undefined,
    bestDocument: undefined,
    bestProposal: undefined,
    cursor: undefined,
    generation,
    status: "pending" as const,
    updatedAt: Date.now(),
  };
  let workerId: Id<"queryCommercialProjectionWorkers">;
  if (existing) {
    if (owned) {
      await patchWithE2eOwnership(
        ctx,
        "queryCommercialProjectionWorkers",
        existing._id,
        workerPatch
      );
    } else {
      await ctx.db.patch("queryCommercialProjectionWorkers", existing._id, workerPatch);
    }
    workerId = existing._id;
  } else if (owned) {
    workerId = await insertWithE2eOwnership(ctx, "queryCommercialProjectionWorkers", {
      ...workerPatch,
      queryId,
    });
  } else {
    workerId = await ctx.db.insert("queryCommercialProjectionWorkers", {
      ...workerPatch,
      queryId,
    });
  }
  const queryPatch = {
    commercialProjectionGeneration: generation,
    commercialProjectionState: "reconciling" as const,
    commercialProjectionVersion: QUERY_COMMERCIAL_PROJECTION_VERSION,
  };
  if (owned) {
    await patchWithE2eOwnership(ctx, "queries", queryId, queryPatch);
  } else {
    await ctx.db.patch("queries", queryId, queryPatch);
  }
  await scheduleCrmMetricSync(ctx, "queries", String(queryId));
  await ctx.scheduler.runAfter(
    0,
    internal.crm.queryCommercialProjection.reconcileQueryCommercialProjection,
    { generation, workerId }
  );
}

export async function enqueueQueryCommercialProjections(
  ctx: MutationCtx,
  queryIds: Iterable<Id<"queries"> | string>
) {
  const normalizedIds = Array.from(
    new Set(
      Array.from(queryIds).flatMap((value) => {
        const queryId = ctx.db.normalizeId("queries", String(value));
        return queryId ? [queryId] : [];
      })
    )
  );
  const generation = Date.now();
  await mapInBoundedBatches(
    normalizedIds,
    async (queryId) => await scheduleWorker(ctx, queryId, generation, true)
  );
}

export async function enqueueProposalQueryCommercialProjections(
  ctx: MutationCtx,
  proposal: Pick<Doc<"proposals">, "_id" | "queryId">
) {
  const links = await ctx.db
    .query("proposalQueryLinks")
    .withIndex("by_proposalId", (query) => query.eq("proposalId", proposal._id))
    .collect();
  await enqueueQueryCommercialProjections(ctx, [
    ...links.map((link) => link.queryId),
    ...(proposal.queryId ? [proposal.queryId] : []),
  ]);
}

async function completeGlobalWorker(ctx: MutationCtx, generation: number) {
  const state = await readiness(ctx);
  if (!(state?.reconciling && state.generation === generation)) {
    return;
  }
  const completedCount = (state.completedCount ?? 0) + 1;
  const ready = state.schedulingComplete && completedCount >= (state.scheduledCount ?? 0);
  await ctx.db.patch("queryCommercialProjectionReadiness", state._id, {
    completedCount,
    ready,
    reconciling: !ready,
    updatedAt: Date.now(),
  });
}

export const reconcileQueryCommercialProjection = internalMutation({
  args: {
    generation: v.number(),
    workerId: v.id("queryCommercialProjectionWorkers"),
  },
  handler: async (ctx, args) => {
    const worker = await ctx.db.get("queryCommercialProjectionWorkers", args.workerId);
    if (!(worker && worker.generation === args.generation && worker.status !== "complete")) {
      return { complete: false, stale: true };
    }
    const query = await ctx.db.get("queries", worker.queryId);
    if (!query) {
      await completeGlobalWorker(ctx, args.generation);
      await ctx.db.delete("queryCommercialProjectionWorkers", worker._id);
      return { complete: true, stale: false };
    }
    const page = await ctx.db
      .query("proposalQueryLinks")
      .withIndex("by_queryId", (builder) => builder.eq("queryId", worker.queryId))
      .paginate({ cursor: worker.cursor ?? null, numItems: RECONCILE_PAGE_SIZE });
    const candidates = await mapInBoundedBatches(page.page, async (link) => ({
      link,
      proposal: await ctx.db.get("proposals", link.proposalId),
    }));
    let { bestAcceptedProposal, bestDocument, bestProposal } = worker;
    for (const { link, proposal } of candidates) {
      if (!proposal) {
        continue;
      }
      const preview = proposalPreview(proposal, link.handedOffRevision);
      bestProposal = selectLatestProposal(bestProposal, preview);
      if (proposal.status === "Accepted") {
        bestAcceptedProposal = selectLatestProposal(bestAcceptedProposal, preview);
      }
      bestDocument = selectProposalDocument(bestDocument, documentCandidate(proposal));
    }
    if (!page.isDone) {
      await ctx.db.patch("queryCommercialProjectionWorkers", worker._id, {
        bestAcceptedProposal,
        bestDocument,
        bestProposal,
        cursor: page.continueCursor,
        status: "running",
        updatedAt: Date.now(),
      });
      await ctx.scheduler.runAfter(
        0,
        internal.crm.queryCommercialProjection.reconcileQueryCommercialProjection,
        args
      );
      return { complete: false, stale: false };
    }
    const [jobCard, queryRow] = await Promise.all([
      ctx.db
        .query("jobCards")
        .withIndex("by_queryId", (builder) => builder.eq("queryId", worker.queryId))
        .first(),
      ctx.db.get("queries", worker.queryId),
    ]);
    const confirmedOffer = queryRow?.confirmedOfferId
      ? await ctx.db.get("confirmedOffers", queryRow.confirmedOfferId)
      : null;
    await ctx.db.patch("queries", worker.queryId, {
      acceptedProposalId: confirmedOffer?.proposalId ?? bestAcceptedProposal?.proposalId,
      commercialProjectionGeneration: args.generation,
      commercialProjectionState: "ready",
      commercialProjectionVersion: QUERY_COMMERCIAL_PROJECTION_VERSION,
      jobCardPreview: jobCard
        ? { jobCardCode: jobCard.jobCode, jobCardId: jobCard._id }
        : undefined,
      proposalDocumentPreview: bestDocument
        ? {
            fileName: bestDocument.fileName,
            proposalId: bestDocument.proposalId,
            uploadedAt: bestDocument.uploadedAt,
          }
        : undefined,
      proposalPreview: bestProposal,
    });
    await scheduleCrmMetricSync(ctx, "queries", String(worker.queryId));
    await completeGlobalWorker(ctx, args.generation);
    await ctx.db.delete("queryCommercialProjectionWorkers", worker._id);
    return { complete: true, stale: false };
  },
  returns: v.object({ complete: v.boolean(), stale: v.boolean() }),
});

export const reconcileAll = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await readiness(ctx);
    const now = Date.now();
    if (
      existing?.reconciling &&
      now - Number(existing.updatedAt ?? existing.startedAt) < STALE_AFTER_MS
    ) {
      return { scheduled: false };
    }
    const generation = Number(existing?.generation ?? 0) + 1;
    const patch = {
      completedCount: 0,
      generation,
      key: PROJECTION_KEY,
      ready: false,
      reconciling: true,
      scheduledCount: 0,
      schedulingComplete: false,
      startedAt: now,
      updatedAt: now,
      version: QUERY_COMMERCIAL_PROJECTION_VERSION,
    };
    if (existing) {
      await ctx.db.patch("queryCommercialProjectionReadiness", existing._id, patch);
    } else {
      await ctx.db.insert("queryCommercialProjectionReadiness", patch);
    }
    await ctx.scheduler.runAfter(
      0,
      internal.crm.queryCommercialProjection.scheduleQueryCommercialProjectionPage,
      { cursor: null, generation }
    );
    return { scheduled: true };
  },
  returns: v.object({ scheduled: v.boolean() }),
});

export const scheduleQueryCommercialProjectionPage = internalMutation({
  args: { cursor: v.union(v.string(), v.null()), generation: v.number() },
  handler: async (ctx, args) => {
    const state = await readiness(ctx);
    if (!(state?.reconciling && state.generation === args.generation)) {
      return { isDone: false, scheduled: 0, stale: true };
    }
    const page = await ctx.db
      .query("queries")
      .withIndex("by_createdAt")
      .paginate({ cursor: args.cursor, numItems: RECONCILE_PAGE_SIZE });
    const pending = page.page.filter(
      (query) =>
        query.commercialProjectionState !== "ready" ||
        query.commercialProjectionVersion !== QUERY_COMMERCIAL_PROJECTION_VERSION
    );
    await ctx.db.patch("queryCommercialProjectionReadiness", state._id, {
      scheduledCount: (state.scheduledCount ?? 0) + pending.length,
      updatedAt: Date.now(),
    });
    await mapInBoundedBatches(
      pending,
      async (query) => await scheduleWorker(ctx, query._id, args.generation, false)
    );
    if (page.isDone) {
      const refreshed = await readiness(ctx);
      if (refreshed?.generation === args.generation) {
        const ready = (refreshed.completedCount ?? 0) >= (refreshed.scheduledCount ?? 0);
        await ctx.db.patch("queryCommercialProjectionReadiness", refreshed._id, {
          ready,
          reconciling: !ready,
          schedulingComplete: true,
          updatedAt: Date.now(),
        });
      }
    } else {
      await ctx.scheduler.runAfter(
        0,
        internal.crm.queryCommercialProjection.scheduleQueryCommercialProjectionPage,
        { cursor: page.continueCursor, generation: args.generation }
      );
    }
    return { isDone: page.isDone, scheduled: pending.length, stale: false };
  },
  returns: v.object({
    isDone: v.boolean(),
    scheduled: v.number(),
    stale: v.boolean(),
  }),
});
