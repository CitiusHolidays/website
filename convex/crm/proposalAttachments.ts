import { makeFunctionReference } from "convex/server";
import { ConvexError, type Value, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx, query } from "../_generated/server";
import {
  proposalAccessResultValidator,
  proposalAttachmentListResultValidator,
  proposalAttachmentRecordResultValidator,
} from "./fileReturnContracts";
import {
  canSeeJobCardRecord,
  canSeeProposalRecord,
  PERMISSIONS,
  requireAnyPermission,
} from "./lib";
import {
  buildProposalAttachmentPreview,
  compareProposalAttachmentsDescending,
  isProposalAttachmentSummaryReady,
  PROPOSAL_ATTACHMENT_SUMMARY_VERSION,
  type ProposalAttachmentPreview,
} from "./proposalAttachmentSummary";

const PROPOSAL_ATTACHMENT_RECONCILE_PAGE_SIZE = 50;
const PROPOSAL_RECONCILE_PAGE_SIZE = 25;
const PROPOSAL_ATTACHMENT_RECONCILIATION_STALE_MS = 60 * 60 * 1000;
const PROPOSAL_ATTACHMENT_READINESS_KEY = "proposalAttachments";

const attachmentPreviewValidator = v.object({
  createdAt: v.number(),
  fileName: v.string(),
  fileSize: v.number(),
  id: v.id("proposalAttachments"),
  mimeType: v.string(),
});

interface ReconcileSummaryPageArgs extends Record<string, Value> {
  attachmentCount: number;
  attachmentCursor: string | null;
  attachmentPreview: ProposalAttachmentPreview[];
  currentProposalId: Id<"proposals"> | null;
  generation: number;
  lastProposal: boolean;
  nextProposalCursor: string | null;
  proposalCursor: string | null;
  proposalQueue: Id<"proposals">[];
}

const reconcileSummaryPageRef = makeFunctionReference<"mutation", ReconcileSummaryPageArgs, null>(
  "crm/proposalAttachments:reconcileSummaryPage"
);

function assertProposalAttachmentSummaryReady(proposal: Doc<"proposals">) {
  if (!isProposalAttachmentSummaryReady(proposal)) {
    throw new ConvexError("PROPOSAL_ATTACHMENTS_PREPARING");
  }
}

async function loadSummaryReadiness(ctx: MutationCtx) {
  return await ctx.db
    .query("proposalAttachmentSummaryReadiness")
    .withIndex("by_key", (q) => q.eq("key", PROPOSAL_ATTACHMENT_READINESS_KEY))
    .unique();
}

async function scheduleSummaryPage(ctx: MutationCtx, args: ReconcileSummaryPageArgs) {
  await ctx.scheduler.runAfter(0, reconcileSummaryPageRef, args);
}

async function completeSummaryReconciliation(ctx: MutationCtx, generation: number) {
  const readiness = await loadSummaryReadiness(ctx);
  if (
    readiness?.generation !== generation ||
    readiness.version !== PROPOSAL_ATTACHMENT_SUMMARY_VERSION ||
    !readiness.reconciling
  ) {
    return;
  }
  await ctx.db.patch(readiness._id, {
    ready: true,
    reconciling: false,
    updatedAt: Date.now(),
  });
}

async function continueWithNextProposal(
  ctx: MutationCtx,
  args: Pick<
    ReconcileSummaryPageArgs,
    "generation" | "lastProposal" | "nextProposalCursor" | "proposalQueue"
  >
) {
  const [nextProposalId, ...proposalQueue] = args.proposalQueue;
  if (nextProposalId) {
    await scheduleSummaryPage(ctx, {
      attachmentCount: 0,
      attachmentCursor: null,
      attachmentPreview: [],
      currentProposalId: nextProposalId,
      generation: args.generation,
      lastProposal: args.lastProposal,
      nextProposalCursor: args.nextProposalCursor,
      proposalCursor: null,
      proposalQueue,
    });
    return;
  }
  if (args.lastProposal) {
    await completeSummaryReconciliation(ctx, args.generation);
    return;
  }
  await scheduleSummaryPage(ctx, {
    attachmentCount: 0,
    attachmentCursor: null,
    attachmentPreview: [],
    currentProposalId: null,
    generation: args.generation,
    lastProposal: false,
    nextProposalCursor: null,
    proposalCursor: args.nextProposalCursor,
    proposalQueue: [],
  });
}

export function publicProposalAttachment(row: {
  _id: Id<"proposalAttachments">;
  fileName: string;
  mimeType: string;
  fileSize: number;
  createdAt: number;
}) {
  return {
    createdAt: new Date(row.createdAt).toISOString(),
    fileName: row.fileName,
    fileSize: row.fileSize,
    id: row._id,
    mimeType: row.mimeType,
  };
}

async function requireVisibleProposal(ctx: any, proposalId: Id<"proposals">) {
  const [access, proposal] = await Promise.all([
    requireAnyPermission(ctx, [
      PERMISSIONS.VIEW_PROPOSALS,
      PERMISSIONS.VIEW_CONTRACTING,
      PERMISSIONS.VIEW_QUERIES,
      PERMISSIONS.VIEW_JOB_CARDS,
    ]),
    ctx.db.get(proposalId),
  ]);
  if (!proposal) {
    throw new ConvexError("Proposal not found");
  }
  const links = await ctx.db
    .query("proposalQueryLinks")
    .withIndex("by_proposalId", (q: any) => q.eq("proposalId", proposalId))
    .collect();
  const queryIds = new Set<string>();
  if (proposal.queryId) {
    queryIds.add(proposal.queryId);
  }
  for (const link of links) {
    queryIds.add(link.queryId);
  }
  const linkedQueries = (
    await Promise.all(Array.from(queryIds, (queryId) => ctx.db.get(queryId)))
  ).filter((linkedQuery): linkedQuery is NonNullable<typeof linkedQuery> => linkedQuery != null);
  const canSeeProposal = canSeeProposalRecord(access, proposal, linkedQueries);
  if (!canSeeProposal) {
    const jobs = await ctx.db
      .query("jobCards")
      .withIndex("by_proposalId", (q: any) => q.eq("proposalId", proposalId))
      .collect();
    const visibleJob = jobs.some((job: any) => {
      const linkedQuery = linkedQueries.find(
        (candidateQuery) => candidateQuery._id === job.queryId
      );
      return canSeeJobCardRecord(access, job, linkedQuery);
    });
    if (visibleJob) {
      return { linkedQueries, proposal };
    }
    throw new ConvexError("FORBIDDEN");
  }
  return { linkedQueries, proposal };
}

export const listForProposal = query({
  args: {
    proposalId: v.string(),
  },
  handler: async (ctx, args) => {
    const proposalId = ctx.db.normalizeId("proposals", args.proposalId);
    if (!proposalId) {
      return [];
    }
    await requireVisibleProposal(ctx, proposalId);
    const rows = await ctx.db
      .query("proposalAttachments")
      .withIndex("by_proposalId", (q) => q.eq("proposalId", proposalId))
      .collect();
    return rows.sort(compareProposalAttachmentsDescending).map(publicProposalAttachment);
  },
  returns: proposalAttachmentListResultValidator,
});

export const verifyProposalAccess = query({
  args: {
    proposalId: v.string(),
  },
  handler: async (ctx, args) => {
    const proposalId = ctx.db.normalizeId("proposals", args.proposalId);
    if (!proposalId) {
      throw new ConvexError("Invalid proposal id");
    }
    await requireVisibleProposal(ctx, proposalId);
    return { id: proposalId };
  },
  returns: proposalAccessResultValidator,
});

export const getAttachmentRecord = query({
  args: {
    attachmentId: v.string(),
  },
  handler: async (ctx, args) => {
    const attachmentId = ctx.db.normalizeId("proposalAttachments", args.attachmentId);
    if (!attachmentId) {
      return null;
    }
    const row = await ctx.db.get(attachmentId);
    if (!row) {
      return null;
    }
    await requireVisibleProposal(ctx, row.proposalId);
    return {
      fileName: row.fileName,
      id: row._id,
      mimeType: row.mimeType,
      proposalId: row.proposalId,
      storageId: row.storageId,
    };
  },
  returns: proposalAttachmentRecordResultValidator,
});

export const resolveProposalId = internalMutation({
  args: {
    proposalId: v.string(),
  },
  handler: async (ctx, args) => {
    const proposalId = ctx.db.normalizeId("proposals", args.proposalId);
    if (!proposalId) {
      throw new ConvexError("Invalid proposal id");
    }
    const proposal = await ctx.db.get(proposalId);
    if (!proposal) {
      throw new ConvexError("Proposal not found");
    }
    return proposalId;
  },
  returns: v.id("proposals"),
});

export const getSummaryReadiness = query({
  args: { referenceNow: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAnyPermission(ctx, [
      PERMISSIONS.VIEW_PROPOSALS,
      PERMISSIONS.VIEW_CONTRACTING,
      PERMISSIONS.VIEW_QUERIES,
      PERMISSIONS.VIEW_JOB_CARDS,
    ]);
    const row = await ctx.db
      .query("proposalAttachmentSummaryReadiness")
      .withIndex("by_key", (q) => q.eq("key", PROPOSAL_ATTACHMENT_READINESS_KEY))
      .unique();
    const current = Boolean(row?.ready && row.version === PROPOSAL_ATTACHMENT_SUMMARY_VERSION);
    const stale = Boolean(
      args.referenceNow !== undefined &&
        row?.reconciling &&
        args.referenceNow - row.updatedAt >= PROPOSAL_ATTACHMENT_RECONCILIATION_STALE_MS
    );
    let state: "pending" | "ready" | "reconciling" | "stale" = "pending";
    if (current) {
      state = "ready";
    } else if (stale) {
      state = "stale";
    } else if (row?.reconciling) {
      state = "reconciling";
    }
    return {
      generation: row?.generation ?? 0,
      ready: current,
      state,
      updatedAt: row?.updatedAt ?? null,
      version: PROPOSAL_ATTACHMENT_SUMMARY_VERSION,
    };
  },
  returns: v.object({
    generation: v.number(),
    ready: v.boolean(),
    state: v.union(
      v.literal("pending"),
      v.literal("ready"),
      v.literal("reconciling"),
      v.literal("stale")
    ),
    updatedAt: v.union(v.number(), v.null()),
    version: v.number(),
  }),
});

export const startSummaryReconciliation = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await loadSummaryReadiness(ctx);
    const now = Date.now();
    const active = Boolean(
      existing?.reconciling &&
        existing.version === PROPOSAL_ATTACHMENT_SUMMARY_VERSION &&
        now - existing.updatedAt < PROPOSAL_ATTACHMENT_RECONCILIATION_STALE_MS
    );
    if (active) {
      return { generation: existing?.generation ?? 0, scheduled: false };
    }
    const generation = (existing?.generation ?? 0) + 1;
    const patch = {
      generation,
      key: PROPOSAL_ATTACHMENT_READINESS_KEY,
      ready: Boolean(existing?.ready && existing.version === PROPOSAL_ATTACHMENT_SUMMARY_VERSION),
      reconciling: true,
      startedAt: now,
      updatedAt: now,
      version: PROPOSAL_ATTACHMENT_SUMMARY_VERSION,
    };
    if (existing) {
      await ctx.db.patch(existing._id, patch);
    } else {
      await ctx.db.insert("proposalAttachmentSummaryReadiness", patch);
    }
    await scheduleSummaryPage(ctx, {
      attachmentCount: 0,
      attachmentCursor: null,
      attachmentPreview: [],
      currentProposalId: null,
      generation,
      lastProposal: false,
      nextProposalCursor: null,
      proposalCursor: null,
      proposalQueue: [],
    });
    return { generation, scheduled: true };
  },
  returns: v.object({ generation: v.number(), scheduled: v.boolean() }),
});

export const reconcileSummaryPage = internalMutation({
  args: {
    attachmentCount: v.number(),
    attachmentCursor: v.union(v.string(), v.null()),
    attachmentPreview: v.array(attachmentPreviewValidator),
    currentProposalId: v.union(v.id("proposals"), v.null()),
    generation: v.number(),
    lastProposal: v.boolean(),
    nextProposalCursor: v.union(v.string(), v.null()),
    proposalCursor: v.union(v.string(), v.null()),
    proposalQueue: v.array(v.id("proposals")),
  },
  handler: async (ctx, args) => {
    const readiness = await loadSummaryReadiness(ctx);
    if (
      readiness?.generation !== args.generation ||
      readiness.version !== PROPOSAL_ATTACHMENT_SUMMARY_VERSION ||
      !readiness.reconciling
    ) {
      return null;
    }

    if (!args.currentProposalId) {
      const proposalPage = await ctx.db
        .query("proposals")
        .order("asc")
        .paginate({ cursor: args.proposalCursor, numItems: PROPOSAL_RECONCILE_PAGE_SIZE });
      const [proposal, ...proposalQueue] = proposalPage.page;
      if (!proposal) {
        await completeSummaryReconciliation(ctx, args.generation);
        return null;
      }
      await scheduleSummaryPage(ctx, {
        attachmentCount: 0,
        attachmentCursor: null,
        attachmentPreview: [],
        currentProposalId: proposal._id,
        generation: args.generation,
        lastProposal: proposalPage.isDone,
        nextProposalCursor: proposalPage.continueCursor,
        proposalCursor: args.proposalCursor,
        proposalQueue: proposalQueue.map((row) => row._id),
      });
      return null;
    }
    const proposal = await ctx.db.get(args.currentProposalId);
    if (!proposal) {
      await continueWithNextProposal(ctx, {
        generation: args.generation,
        lastProposal: args.lastProposal,
        nextProposalCursor: args.nextProposalCursor,
        proposalQueue: args.proposalQueue,
      });
      return null;
    }

    if (args.attachmentCursor === null && isProposalAttachmentSummaryReady(proposal)) {
      await continueWithNextProposal(ctx, {
        generation: args.generation,
        lastProposal: args.lastProposal,
        nextProposalCursor: args.nextProposalCursor,
        proposalQueue: args.proposalQueue,
      });
      return null;
    }

    if (args.attachmentCursor === null) {
      await ctx.db.patch(proposal._id, {
        attachmentSummaryGeneration: args.generation,
        attachmentSummaryState: "reconciling",
      });
    }

    const attachmentPage = await ctx.db
      .query("proposalAttachments")
      .withIndex("by_proposalId", (q) => q.eq("proposalId", proposal._id))
      .paginate({
        cursor: args.attachmentCursor,
        numItems: PROPOSAL_ATTACHMENT_RECONCILE_PAGE_SIZE,
      });
    await Promise.all(
      attachmentPage.page.map((attachment) =>
        attachment.orderId === String(attachment._id)
          ? Promise.resolve()
          : ctx.db.patch(attachment._id, { orderId: String(attachment._id) })
      )
    );
    const attachmentCount = args.attachmentCount + attachmentPage.page.length;
    const attachmentPreview = buildProposalAttachmentPreview([
      ...args.attachmentPreview,
      ...attachmentPage.page,
    ]);
    await ctx.db.patch(readiness._id, { updatedAt: Date.now() });

    if (!attachmentPage.isDone) {
      await scheduleSummaryPage(ctx, {
        attachmentCount,
        attachmentCursor: attachmentPage.continueCursor,
        attachmentPreview,
        currentProposalId: proposal._id,
        generation: args.generation,
        lastProposal: args.lastProposal,
        nextProposalCursor: args.nextProposalCursor,
        proposalCursor: args.proposalCursor,
        proposalQueue: args.proposalQueue,
      });
      return null;
    }

    await ctx.db.patch(proposal._id, {
      attachmentCount,
      attachmentPreview,
      attachmentSummaryGeneration: args.generation,
      attachmentSummaryState: "ready",
      attachmentSummaryVersion: PROPOSAL_ATTACHMENT_SUMMARY_VERSION,
    });
    await continueWithNextProposal(ctx, {
      generation: args.generation,
      lastProposal: args.lastProposal,
      nextProposalCursor: args.nextProposalCursor,
      proposalQueue: args.proposalQueue,
    });
    return null;
  },
  returns: v.null(),
});

export const saveAttachment = internalMutation({
  args: {
    createdBy: v.string(),
    fileName: v.string(),
    fileSize: v.number(),
    mimeType: v.string(),
    proposalId: v.id("proposals"),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const proposal = await ctx.db.get(args.proposalId);
    if (!proposal) {
      throw new ConvexError("Proposal not found");
    }
    assertProposalAttachmentSummaryReady(proposal);
    const createdAt = Date.now();
    const id = await ctx.db.insert("proposalAttachments", {
      createdAt,
      createdBy: args.createdBy,
      fileName: args.fileName,
      fileSize: args.fileSize,
      mimeType: args.mimeType,
      proposalId: args.proposalId,
      storageId: args.storageId,
    });
    await ctx.db.patch(id, { orderId: String(id) });
    const attachmentPreview = buildProposalAttachmentPreview([
      {
        createdAt,
        fileName: args.fileName,
        fileSize: args.fileSize,
        id,
        mimeType: args.mimeType,
      },
      ...(proposal.attachmentPreview ?? []),
    ]);
    await ctx.db.patch(args.proposalId, {
      attachmentCount: (proposal.attachmentCount ?? 0) + 1,
      attachmentPreview,
    });
    return null;
  },
  returns: v.null(),
});

export const deleteAttachmentRecord = internalMutation({
  args: {
    attachmentId: v.id("proposalAttachments"),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.attachmentId);
    if (!row) {
      return { storageId: null as Id<"_storage"> | null };
    }
    const proposal = await ctx.db.get(row.proposalId);
    if (proposal) {
      assertProposalAttachmentSummaryReady(proposal);
    }
    await ctx.db.delete(args.attachmentId);
    if (proposal) {
      const remaining = await ctx.db
        .query("proposalAttachments")
        .withIndex("by_proposalId_and_createdAt_and_orderId", (q) =>
          q.eq("proposalId", row.proposalId)
        )
        .order("desc")
        .take(3);
      await ctx.db.patch(row.proposalId, {
        attachmentCount: Math.max(0, (proposal.attachmentCount ?? 0) - 1),
        attachmentPreview: buildProposalAttachmentPreview(remaining),
      });
    }
    return { storageId: row.storageId };
  },
  returns: v.object({ storageId: v.union(v.id("_storage"), v.null()) }),
});

export const deleteAllForProposal = internalMutation({
  args: {
    proposalId: v.id("proposals"),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("proposalAttachments")
      .withIndex("by_proposalId", (q) => q.eq("proposalId", args.proposalId))
      .collect();
    const storageIds = rows.map((row) => row.storageId);
    await Promise.all(rows.map((row) => ctx.db.delete(row._id)));
    return { storageIds };
  },
  returns: v.object({ storageIds: v.array(v.id("_storage")) }),
});
