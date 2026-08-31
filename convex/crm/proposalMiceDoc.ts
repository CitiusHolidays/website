import { makeFunctionReference } from "convex/server";
import { ConvexError, v } from "convex/values";
import {
  type InboundEnquiryBrief,
  isInboundReceiptReference,
} from "../../src/lib/contact/inboundIntentContract";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { inboundEnquiryBriefValidator } from "../lib/inboundIntentValidators";
import { digestCommandPayload } from "./commandReceipts";
import {
  canEditProposalRecord,
  canSeeProposalRecord,
  canSeeQueryRecord,
  PERMISSIONS,
  type PortalAccess,
  requireStaff,
} from "./lib";
import { insertWithE2eOwnership, patchWithE2eOwnership } from "./lib/e2eOwnership";

const SOURCE_BRIEF_REVISION = 1;
const MICE_DOC_CLEANUP_BATCH_SIZE = 32;

const miceDocStatusValidator = v.union(
  v.literal("draft"),
  v.literal("reviewed"),
  v.literal("approved_for_manual_send")
);

const publicDraftValidator = v.object({
  approvedForManualSendAt: v.union(v.number(), v.null()),
  approvedForManualSendByName: v.union(v.string(), v.null()),
  brandName: v.literal("Citius Holidays"),
  brief: inboundEnquiryBriefValidator,
  clientName: v.string(),
  createdAt: v.number(),
  createdByName: v.string(),
  id: v.id("proposalMiceDocDrafts"),
  proposalCode: v.string(),
  proposalRevision: v.number(),
  queryCode: v.string(),
  reviewedAt: v.union(v.number(), v.null()),
  reviewedByName: v.union(v.string(), v.null()),
  sourceAcceptedAt: v.number(),
  sourceBriefDigest: v.string(),
  sourceBriefRevision: v.number(),
  sourceReceiptReference: v.string(),
  status: miceDocStatusValidator,
});

export const miceDocForPairResultValidator = v.union(
  v.object({
    draft: v.union(publicDraftValidator, v.null()),
    source: v.object({
      acceptedAt: v.number(),
      brief: inboundEnquiryBriefValidator,
      briefDigest: v.string(),
      briefRevision: v.number(),
      clientName: v.string(),
      receiptReference: v.string(),
    }),
  }),
  v.null()
);

export const miceDocTransitionResultValidator = v.object({
  id: v.id("proposalMiceDocDrafts"),
  replayed: v.boolean(),
  status: miceDocStatusValidator,
});

type ProposalCtx = MutationCtx | QueryCtx;

interface PairArgs {
  proposalId: string;
  proposalRevision: number;
  queryId: string;
}

interface AcceptedMiceSource {
  acceptedAt: number;
  brief: InboundEnquiryBrief;
  briefDigest: string;
  briefRevision: number;
  clientName: string;
  intentId: Id<"inboundQueryIntents">;
  receiptReference: string;
}

function requireStableStaffId(access: PortalAccess) {
  if (!access.staffId) {
    throw new ConvexError("A stable Staff identity is required for Proposal Doc review");
  }
  return access.staffId;
}

function normalizePair(ctx: ProposalCtx, args: PairArgs) {
  const proposalId = ctx.db.normalizeId("proposals", args.proposalId);
  const queryId = ctx.db.normalizeId("queries", args.queryId);
  if (!proposalId) {
    throw new ConvexError("Invalid proposal id");
  }
  if (!queryId) {
    throw new ConvexError("Invalid query id");
  }
  if (!(Number.isSafeInteger(args.proposalRevision) && args.proposalRevision > 0)) {
    throw new ConvexError("Proposal revision must be a positive integer");
  }
  return { proposalId, proposalRevision: args.proposalRevision, queryId };
}

async function loadVisibleCurrentPair(ctx: ProposalCtx, access: PortalAccess, args: PairArgs) {
  const target = normalizePair(ctx, args);
  const [proposal, query, link] = await Promise.all([
    ctx.db.get("proposals", target.proposalId),
    ctx.db.get("queries", target.queryId),
    ctx.db
      .query("proposalQueryLinks")
      .withIndex("by_proposalId_and_queryId", (q) =>
        q.eq("proposalId", target.proposalId).eq("queryId", target.queryId)
      )
      .unique(),
  ]);
  if (!(proposal && query && link)) {
    throw new ConvexError("The Proposal and Query pair was not found");
  }
  if (!(canSeeQueryRecord(access, query) && canSeeProposalRecord(access, proposal, [query]))) {
    throw new ConvexError("FORBIDDEN");
  }
  if ((proposal.proposalRevision ?? 1) !== target.proposalRevision) {
    throw new ConvexError("The Proposal Doc draft is not bound to the current Proposal revision");
  }
  return { proposal, query, target };
}

async function acceptedMiceSource(
  ctx: ProposalCtx,
  query: Doc<"queries">
): Promise<AcceptedMiceSource | null> {
  if (!query.inboundIntentId) {
    return null;
  }
  const intent = await ctx.db.get("inboundQueryIntents", query.inboundIntentId);
  if (
    !(
      intent?.source === "Website" &&
      intent.status === "converted" &&
      intent.convertedQueryId === String(query._id) &&
      intent.websiteSourceContext?.intent === "mice-proposal" &&
      intent.brief?.serviceType === "meetings_events" &&
      isInboundReceiptReference(intent.receiptReference)
    )
  ) {
    return null;
  }
  const briefDigest = await digestCommandPayload({
    acceptedAt: intent.consentAt,
    brief: intent.brief,
    briefRevision: SOURCE_BRIEF_REVISION,
    clientName: intent.clientName,
    receiptReference: intent.receiptReference,
  });
  return {
    acceptedAt: intent.consentAt,
    brief: intent.brief,
    briefDigest,
    briefRevision: SOURCE_BRIEF_REVISION,
    clientName: intent.clientName,
    intentId: intent._id,
    receiptReference: intent.receiptReference,
  };
}

async function requireAcceptedMiceSource(ctx: ProposalCtx, query: Doc<"queries">) {
  const source = await acceptedMiceSource(ctx, query);
  if (!source) {
    throw new ConvexError("This Query has no accepted MICE enquiry brief");
  }
  return source;
}

async function draftForPair(
  ctx: ProposalCtx,
  target: ReturnType<typeof normalizePair>
): Promise<Doc<"proposalMiceDocDrafts"> | null> {
  return await ctx.db
    .query("proposalMiceDocDrafts")
    .withIndex("by_proposalId_queryId_revision", (q) =>
      q
        .eq("proposalId", target.proposalId)
        .eq("queryId", target.queryId)
        .eq("proposalRevision", target.proposalRevision)
    )
    .unique();
}

function assertSourceCurrent(draft: Doc<"proposalMiceDocDrafts">, source: AcceptedMiceSource) {
  if (
    draft.sourceInboundIntentId !== source.intentId ||
    draft.sourceBriefRevision !== source.briefRevision ||
    draft.sourceBriefDigest !== source.briefDigest ||
    draft.sourceReceiptReference !== source.receiptReference ||
    draft.sourceAcceptedAt !== source.acceptedAt
  ) {
    throw new ConvexError("The accepted MICE brief changed. Generate a new revision-bound draft");
  }
}

function presentDraft(draft: Doc<"proposalMiceDocDrafts">) {
  return {
    approvedForManualSendAt: draft.approvedForManualSendAt ?? null,
    approvedForManualSendByName: draft.approvedForManualSendByName ?? null,
    brandName: draft.brandName,
    brief: draft.brief,
    clientName: draft.clientName,
    createdAt: draft.createdAt,
    createdByName: draft.createdByName,
    id: draft._id,
    proposalCode: draft.proposalCode,
    proposalRevision: draft.proposalRevision,
    queryCode: draft.queryCode,
    reviewedAt: draft.reviewedAt ?? null,
    reviewedByName: draft.reviewedByName ?? null,
    sourceAcceptedAt: draft.sourceAcceptedAt,
    sourceBriefDigest: draft.sourceBriefDigest,
    sourceBriefRevision: draft.sourceBriefRevision,
    sourceReceiptReference: draft.sourceReceiptReference,
    status: draft.status,
  };
}

export async function handleGetMiceDocDraft(ctx: QueryCtx, args: PairArgs) {
  const access = await requireStaff(ctx, PERMISSIONS.VIEW_PROPOSALS);
  const { query, target } = await loadVisibleCurrentPair(ctx, access, args);
  const source = await acceptedMiceSource(ctx, query);
  if (!source) {
    return null;
  }
  const draft = await draftForPair(ctx, target);
  if (draft) {
    assertSourceCurrent(draft, source);
  }
  return {
    draft: draft ? presentDraft(draft) : null,
    source: {
      acceptedAt: source.acceptedAt,
      brief: source.brief,
      briefDigest: source.briefDigest,
      briefRevision: source.briefRevision,
      clientName: source.clientName,
      receiptReference: source.receiptReference,
    },
  };
}

export async function handleCreateMiceDocDraft(ctx: MutationCtx, args: PairArgs) {
  const access = await requireStaff(ctx, PERMISSIONS.MANAGE_PROPOSALS);
  const staffId = requireStableStaffId(access);
  const { proposal, query, target } = await loadVisibleCurrentPair(ctx, access, args);
  if (!canEditProposalRecord(access, proposal, [query])) {
    throw new ConvexError("FORBIDDEN");
  }
  const source = await requireAcceptedMiceSource(ctx, query);
  const existing = await draftForPair(ctx, target);
  if (existing) {
    assertSourceCurrent(existing, source);
    return { id: existing._id, replayed: true, status: existing.status };
  }
  const id = await insertWithE2eOwnership(ctx, "proposalMiceDocDrafts", {
    brandName: "Citius Holidays",
    brief: source.brief,
    clientName: source.clientName,
    createdAt: Date.now(),
    createdByName: access.name,
    createdByStaffId: staffId,
    proposalCode: proposal.proposalCode,
    proposalId: target.proposalId,
    proposalRevision: target.proposalRevision,
    queryCode: query.queryCode,
    queryId: target.queryId,
    sourceAcceptedAt: source.acceptedAt,
    sourceBriefDigest: source.briefDigest,
    sourceBriefRevision: source.briefRevision,
    sourceInboundIntentId: source.intentId,
    sourceReceiptReference: source.receiptReference,
    status: "draft",
  });
  return { id, replayed: false, status: "draft" as const };
}

export async function handleMarkMiceDocDraftReviewed(ctx: MutationCtx, args: PairArgs) {
  const access = await requireStaff(ctx, PERMISSIONS.MANAGE_PROPOSALS);
  const staffId = requireStableStaffId(access);
  const { proposal, query, target } = await loadVisibleCurrentPair(ctx, access, args);
  if (!canEditProposalRecord(access, proposal, [query])) {
    throw new ConvexError("FORBIDDEN");
  }
  const [source, draft] = await Promise.all([
    requireAcceptedMiceSource(ctx, query),
    draftForPair(ctx, target),
  ]);
  if (!draft) {
    throw new ConvexError("Generate the Proposal Doc draft before review");
  }
  assertSourceCurrent(draft, source);
  if (draft.status !== "draft") {
    return { id: draft._id, replayed: true, status: draft.status };
  }
  await patchWithE2eOwnership(ctx, "proposalMiceDocDrafts", draft._id, {
    reviewedAt: Date.now(),
    reviewedByName: access.name,
    reviewedByStaffId: staffId,
    status: "reviewed",
  });
  return { id: draft._id, replayed: false, status: "reviewed" as const };
}

export async function handleApproveMiceDocDraftForManualSend(ctx: MutationCtx, args: PairArgs) {
  const access = await requireStaff(ctx, PERMISSIONS.SEND_PROPOSALS);
  const staffId = requireStableStaffId(access);
  const { query, target } = await loadVisibleCurrentPair(ctx, access, args);
  const [source, draft] = await Promise.all([
    requireAcceptedMiceSource(ctx, query),
    draftForPair(ctx, target),
  ]);
  if (!draft) {
    throw new ConvexError("Generate and review the Proposal Doc draft before approval");
  }
  assertSourceCurrent(draft, source);
  if (draft.status === "approved_for_manual_send") {
    return { id: draft._id, replayed: true, status: draft.status };
  }
  if (draft.status !== "reviewed") {
    throw new ConvexError("A Proposal Doc draft must be reviewed before send approval");
  }
  await patchWithE2eOwnership(ctx, "proposalMiceDocDrafts", draft._id, {
    approvedForManualSendAt: Date.now(),
    approvedForManualSendByName: access.name,
    approvedForManualSendByStaffId: staffId,
    status: "approved_for_manual_send",
  });
  return {
    id: draft._id,
    replayed: false,
    status: "approved_for_manual_send" as const,
  };
}

export async function deleteMiceDocDraftsForPair(
  ctx: MutationCtx,
  proposalId: Id<"proposals">,
  queryId: Id<"queries">
) {
  const proposal = await ctx.db.get("proposals", proposalId);
  if (!proposal) {
    throw new ConvexError("Proposal not found");
  }
  await deleteMiceDocDraftBatch(ctx, {
    kind: "pair",
    proposalId,
    queryId,
    throughRevision: proposal.proposalRevision ?? 1,
  });
}

export async function deleteMiceDocDraftsForProposal(
  ctx: MutationCtx,
  proposalId: Id<"proposals">
) {
  await deleteMiceDocDraftBatch(ctx, { kind: "proposal", proposalId });
}

const miceDocCleanupScopeValidator = v.union(
  v.object({
    kind: v.literal("pair"),
    proposalId: v.id("proposals"),
    queryId: v.id("queries"),
    throughRevision: v.number(),
  }),
  v.object({ kind: v.literal("proposal"), proposalId: v.id("proposals") })
);

type MiceDocCleanupScope =
  | {
      kind: "pair";
      proposalId: Id<"proposals">;
      queryId: Id<"queries">;
      throughRevision: number;
    }
  | { kind: "proposal"; proposalId: Id<"proposals"> };

const continueMiceDocDraftCleanupRef = makeFunctionReference<
  "mutation",
  { scope: MiceDocCleanupScope },
  null
>("crm/proposalMiceDoc:continueMiceDocDraftCleanup");

async function deleteMiceDocDraftBatch(ctx: MutationCtx, scope: MiceDocCleanupScope) {
  const drafts =
    scope.kind === "pair"
      ? await ctx.db
          .query("proposalMiceDocDrafts")
          .withIndex("by_proposalId_queryId_revision", (q) =>
            q
              .eq("proposalId", scope.proposalId)
              .eq("queryId", scope.queryId)
              .lte("proposalRevision", scope.throughRevision)
          )
          .take(MICE_DOC_CLEANUP_BATCH_SIZE)
      : await ctx.db
          .query("proposalMiceDocDrafts")
          .withIndex("by_proposalId_createdAt", (q) => q.eq("proposalId", scope.proposalId))
          .take(MICE_DOC_CLEANUP_BATCH_SIZE);
  await Promise.all(drafts.map((draft) => ctx.db.delete("proposalMiceDocDrafts", draft._id)));
  if (drafts.length === MICE_DOC_CLEANUP_BATCH_SIZE) {
    await ctx.scheduler.runAfter(0, continueMiceDocDraftCleanupRef, { scope });
  }
}

export const continueMiceDocDraftCleanup = internalMutation({
  args: { scope: miceDocCleanupScopeValidator },
  handler: async (ctx, args) => {
    await deleteMiceDocDraftBatch(ctx, args.scope);
    return null;
  },
  returns: v.null(),
});
