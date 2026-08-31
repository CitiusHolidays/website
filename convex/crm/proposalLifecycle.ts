import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { RuntimeObject } from "../lib/runtimeValues";
import { digestCommandPayload } from "./commandReceipts";
import {
  canSeeProposalRecord,
  canSeeQueryRecord,
  PERMISSIONS,
  type PortalAccess,
  requireAnyPermission,
} from "./lib";
import { insertWithE2eOwnership, patchWithE2eOwnership } from "./lib/e2eOwnership";
import type { SalesDecisionCommand } from "./queryStatusPolicy";
import { assertReferenceNow } from "./referenceTimePolicy";

const PAIR_TIMELINE_LIMIT = 50;
const MAX_REVISION_REASON_LENGTH = 500;

export type ProposalPairState =
  | "Confirmed"
  | "Draft"
  | "Lost"
  | "Revision requested"
  | "Stale"
  | "Unknown"
  | "With Sales";

export interface ExactProposalDecisionTarget {
  handoff: Doc<"proposalQueryHandoffs">;
  link: Doc<"proposalQueryLinks">;
  proposal: Doc<"proposals">;
  query: Doc<"queries">;
}

interface ProposalPairStateInput {
  currentProposalRevision: number;
  decisionRevision?: number;
  decisionStatus?: string;
  handedOffAt?: number;
  handedOffRevision?: number;
  revisionRequestedAt?: number;
}

type RequestedQueryChanges = RuntimeObject & {
  destination?: { from: string; to: string };
  travelEndDate?: { from: string; to: string };
  travelStartDate?: { from: string; to: string };
};

function requireStableStaffActor(access: PortalAccess) {
  if (!access.staffId) {
    throw new ConvexError("A stable Staff identity is required for this commercial decision");
  }
  return access.staffId;
}

export function deriveProposalPairState(input: ProposalPairStateInput): ProposalPairState {
  if (
    input.decisionRevision === input.handedOffRevision &&
    input.decisionStatus === "Order Confirmed"
  ) {
    return "Confirmed";
  }
  if (input.decisionRevision === input.handedOffRevision && input.decisionStatus === "Order Lost") {
    return "Lost";
  }
  if (input.revisionRequestedAt) {
    return "Revision requested";
  }
  if (!input.handedOffRevision) {
    return input.handedOffAt ? "Unknown" : "Draft";
  }
  if (input.handedOffRevision !== input.currentProposalRevision) {
    return "Stale";
  }
  return "With Sales";
}

function normalizePairTarget(
  ctx: MutationCtx | QueryCtx,
  args: { proposalId: string; proposalRevision?: number; queryId: string }
) {
  const proposalId = ctx.db.normalizeId("proposals", args.proposalId);
  const queryId = ctx.db.normalizeId("queries", args.queryId);
  if (!proposalId) {
    throw new ConvexError("Invalid proposal id");
  }
  if (!queryId) {
    throw new ConvexError("Invalid query id");
  }
  if (
    args.proposalRevision !== undefined &&
    !(Number.isSafeInteger(args.proposalRevision) && args.proposalRevision > 0)
  ) {
    throw new ConvexError("Proposal revision must be a positive integer");
  }
  return { proposalId, proposalRevision: args.proposalRevision, queryId };
}

async function loadVisiblePair(
  ctx: MutationCtx | QueryCtx,
  access: PortalAccess,
  args: { proposalId: string; queryId: string }
) {
  const target = normalizePairTarget(ctx, args);
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
  return { link, proposal, query, target };
}

export async function loadExactProposalDecisionTarget(
  ctx: MutationCtx,
  access: PortalAccess,
  args: { proposalId: string; proposalRevision: number; queryId: string },
  options: { allowHistorical?: boolean } = {}
): Promise<ExactProposalDecisionTarget> {
  requireStableStaffActor(access);
  const { link, proposal, query, target } = await loadVisiblePair(ctx, access, args);
  const { proposalRevision } = target;
  if (proposalRevision === undefined) {
    throw new ConvexError("Proposal revision is required");
  }
  const currentRevision = proposal.proposalRevision ?? 1;
  if (
    !options.allowHistorical &&
    (proposalRevision !== currentRevision || link.handedOffRevision !== proposalRevision)
  ) {
    throw new ConvexError(
      "The selected Proposal revision is not the current revision handed to Sales. Refresh and try again."
    );
  }
  const handoff = await ctx.db
    .query("proposalQueryHandoffs")
    .withIndex("by_proposalId_queryId_revision", (q) =>
      q
        .eq("proposalId", target.proposalId)
        .eq("queryId", target.queryId)
        .eq("proposalRevision", proposalRevision)
    )
    .unique();
  if (!handoff) {
    throw new ConvexError("The exact Proposal revision has no immutable Sales handoff.");
  }
  return { handoff, link, proposal, query };
}

function revisionChanges(
  current: Pick<Doc<"queries">, "destination" | "travelEndDate" | "travelStartDate">,
  args: SalesDecisionCommand
) {
  const changes: RequestedQueryChanges = {};
  const nextDestination = args.destination?.trim() ?? current.destination?.trim() ?? "";
  const currentDestination = current.destination?.trim() ?? "";
  if (nextDestination !== currentDestination) {
    changes.destination = { from: currentDestination, to: nextDestination };
  }
  const nextStart = args.travelStartDate ?? current.travelStartDate ?? "";
  const currentStart = current.travelStartDate ?? "";
  if (nextStart !== currentStart) {
    changes.travelStartDate = { from: currentStart, to: nextStart };
  }
  const nextEnd = args.travelEndDate ?? current.travelEndDate ?? "";
  const currentEnd = current.travelEndDate ?? "";
  if (nextEnd !== currentEnd) {
    changes.travelEndDate = { from: currentEnd, to: nextEnd };
  }
  return changes;
}

async function createRevisionRequest(
  ctx: MutationCtx,
  access: PortalAccess,
  target: ExactProposalDecisionTarget,
  args: SalesDecisionCommand,
  commandId: string,
  now: number
) {
  const reason = args.reason?.trim() ?? "";
  if (!reason) {
    throw new ConvexError("Explain why this Proposal revision must change.");
  }
  if (reason.length > MAX_REVISION_REASON_LENGTH) {
    throw new ConvexError(
      `Revision reason must be ${MAX_REVISION_REASON_LENGTH} characters or less.`
    );
  }
  const existing = await ctx.db
    .query("proposalRevisionRequests")
    .withIndex("by_proposalId_queryId_status", (q) =>
      q.eq("proposalId", target.proposal._id).eq("queryId", target.query._id).eq("status", "Open")
    )
    .take(2);
  if (existing.length > 0) {
    throw new ConvexError("This Proposal and Query pair already has an open revision request.");
  }
  const requestedChanges = revisionChanges(target.query, args);
  const decisionDigest = await digestCommandPayload({
    decision: args.salesStatus,
    handoffId: String(target.handoff._id),
    proposalId: String(target.proposal._id),
    proposalRevision: target.handoff.proposalRevision,
    queryId: String(target.query._id),
    reason,
    requestedChanges,
  });
  const staffId = requireStableStaffActor(access);
  const id = await insertWithE2eOwnership(ctx, "proposalRevisionRequests", {
    commandId,
    decisionDigest,
    proposalId: target.proposal._id,
    queryId: target.query._id,
    reason,
    requestedAt: now,
    requestedBy: access.authUserId ?? access.email,
    requestedByName: access.name,
    requestedByStaffId: staffId,
    requestedChanges,
    sourceHandoffId: target.handoff._id,
    sourceProposalRevision: target.handoff.proposalRevision,
    status: "Open",
  });
  return { decisionDigest, id };
}

export async function recordProposalQueryDecision(
  ctx: MutationCtx,
  access: PortalAccess,
  target: ExactProposalDecisionTarget,
  args: SalesDecisionCommand,
  input: { commandId: string; now: number; payloadDigest: string }
) {
  const staffId = requireStableStaffActor(access);
  const revisionRequest =
    args.salesStatus === "Date/Destination Change Required"
      ? await createRevisionRequest(ctx, access, target, args, input.commandId, input.now)
      : null;
  const decisionId = await insertWithE2eOwnership(ctx, "proposalQueryDecisions", {
    commandId: input.commandId,
    decidedAt: input.now,
    decidedBy: access.authUserId ?? access.email,
    decidedByName: access.name,
    decidedByStaffId: staffId,
    decision: args.salesStatus,
    handoffId: target.handoff._id,
    payloadDigest: input.payloadDigest,
    proposalId: target.proposal._id,
    proposalRevision: target.handoff.proposalRevision,
    queryId: target.query._id,
    revisionRequestId: revisionRequest?.id,
  });
  await patchWithE2eOwnership(ctx, "proposalQueryLinks", target.link._id, {
    decisionAt: input.now,
    decisionDigest: revisionRequest?.decisionDigest ?? input.payloadDigest,
    decisionRevision: target.handoff.proposalRevision,
    decisionStatus: args.salesStatus,
    revisionRequestedAt: revisionRequest ? input.now : target.link.revisionRequestedAt,
  });
  return { decisionId, revisionRequestId: revisionRequest?.id };
}

export async function openRevisionRequestForPair(
  ctx: MutationCtx,
  proposalId: Id<"proposals">,
  queryId: Id<"queries">
) {
  const requests = await ctx.db
    .query("proposalRevisionRequests")
    .withIndex("by_proposalId_queryId_status", (q) =>
      q.eq("proposalId", proposalId).eq("queryId", queryId).eq("status", "Open")
    )
    .take(2);
  if (requests.length > 1) {
    throw new ConvexError("Conflicting open revision requests must be reviewed before handoff.");
  }
  return requests[0] ?? null;
}

export async function resolveRevisionRequestWithHandoff(
  ctx: MutationCtx,
  access: PortalAccess,
  request: Doc<"proposalRevisionRequests"> | null,
  handoffId: Id<"proposalQueryHandoffs">,
  proposalRevision: number,
  resolvedAt: number
) {
  if (!request) {
    return;
  }
  if (proposalRevision <= request.sourceProposalRevision) {
    throw new ConvexError("A revision request requires a newer Proposal revision handoff.");
  }
  const staffId = requireStableStaffActor(access);
  await patchWithE2eOwnership(ctx, "proposalRevisionRequests", request._id, {
    resolvedAt,
    resolvedBy: access.authUserId ?? access.email,
    resolvedByName: access.name,
    resolvedByStaffId: staffId,
    resolvingHandoffId: handoffId,
    resolvingProposalRevision: proposalRevision,
    status: "Resolved",
  });
}

export function proposalPairClock(
  startedAt: number | undefined,
  endedAt: number | undefined,
  referenceNow: number
) {
  if (startedAt === undefined) {
    return { elapsedMs: null, endedAt: null, startedAt: null, status: "Unknown" as const };
  }
  const hasEnded = endedAt !== undefined;
  const effectiveEnd = endedAt ?? referenceNow;
  return {
    elapsedMs: Math.max(0, effectiveEnd - startedAt),
    endedAt: endedAt ?? null,
    startedAt,
    status: hasEnded ? ("Complete" as const) : ("Running" as const),
  };
}

function unknownClock() {
  return { elapsedMs: null, endedAt: null, startedAt: null, status: "Unknown" as const };
}

function capped<Row>(rows: Row[]) {
  return { rows: rows.slice(0, PAIR_TIMELINE_LIMIT), truncated: rows.length > PAIR_TIMELINE_LIMIT };
}

type TimelineEventType =
  | "Confirmed Offer"
  | "Handoff"
  | "Job Card opened"
  | "Proposal created"
  | "Revision requested"
  | "Revision resolved"
  | "Sales decision";

interface ProposalTimelineEvent {
  actorName: string;
  at: number;
  digest: null | string;
  label: string;
  revision: null | number;
  type: TimelineEventType;
}

function revisionRequestEvents(
  requests: Doc<"proposalRevisionRequests">[]
): ProposalTimelineEvent[] {
  return requests.flatMap((request) => [
    {
      actorName: request.requestedByName,
      at: request.requestedAt,
      digest: request.decisionDigest,
      label: request.reason,
      revision: request.sourceProposalRevision,
      type: "Revision requested" as const,
    },
    ...(request.resolvedAt
      ? [
          {
            actorName: request.resolvedByName ?? "Unknown Staff",
            at: request.resolvedAt,
            digest: request.decisionDigest,
            label: `Resolved by revision ${request.resolvingProposalRevision ?? "Unknown"} handoff`,
            revision: request.resolvingProposalRevision ?? request.sourceProposalRevision,
            type: "Revision resolved" as const,
          },
        ]
      : []),
  ]);
}

function confirmedOfferEvent(offer: Doc<"confirmedOffers"> | null): ProposalTimelineEvent[] {
  return offer?.confirmedAt
    ? [
        {
          actorName: "Sales workflow",
          at: offer.confirmedAt,
          digest: null,
          label: `Confirmed Offer frozen at revision ${offer.proposalRevision ?? "Unknown"}`,
          revision: offer.proposalRevision ?? null,
          type: "Confirmed Offer",
        },
      ]
    : [];
}

function jobCardEvent(jobCard: Doc<"jobCards"> | null): ProposalTimelineEvent[] {
  return jobCard
    ? [
        {
          actorName: "Accounts workflow",
          at: jobCard.createdAt,
          digest: null,
          label: `${jobCard.jobCode} opened`,
          revision: jobCard.proposalRevision ?? null,
          type: "Job Card opened",
        },
      ]
    : [];
}

function buildProposalTimelineEvents(input: {
  decisions: Doc<"proposalQueryDecisions">[];
  handoffs: Doc<"proposalQueryHandoffs">[];
  jobCard: Doc<"jobCards"> | null;
  offer: Doc<"confirmedOffers"> | null;
  proposal: Doc<"proposals">;
  requests: Doc<"proposalRevisionRequests">[];
}) {
  const events: ProposalTimelineEvent[] = [
    {
      actorName: input.proposal.preparedBy,
      at: input.proposal.createdAt,
      digest: null,
      label: "Proposal authoring began",
      revision: 1,
      type: "Proposal created",
    },
    ...input.handoffs.map((handoff) => ({
      actorName: handoff.handedOffByName ?? "Unknown Staff",
      at: handoff.handedOffAt,
      digest: handoff.commercialDigest ?? null,
      label: `Revision ${handoff.proposalRevision} handed to Sales`,
      revision: handoff.proposalRevision,
      type: "Handoff" as const,
    })),
    ...revisionRequestEvents(input.requests),
    ...input.decisions.map((decision) => ({
      actorName: decision.decidedByName,
      at: decision.decidedAt,
      digest: decision.payloadDigest,
      label: decision.decision,
      revision: decision.proposalRevision,
      type: "Sales decision" as const,
    })),
    ...confirmedOfferEvent(input.offer),
    ...jobCardEvent(input.jobCard),
  ];
  return events.sort((left, right) => left.at - right.at || left.label.localeCompare(right.label));
}

function exactConfirmationToJobCardClock(
  offer: Doc<"confirmedOffers"> | null,
  jobCard: Doc<"jobCards"> | null,
  referenceNow: number
) {
  if (!(offer?.proposalQueryHandoffId && offer.proposalRevision)) {
    return unknownClock();
  }
  if (!jobCard) {
    return proposalPairClock(offer.confirmedAt, undefined, referenceNow);
  }
  if (
    !jobCard.proposalQueryHandoffId ||
    offer.proposalQueryHandoffId !== jobCard.proposalQueryHandoffId ||
    offer.proposalRevision !== jobCard.proposalRevision
  ) {
    return unknownClock();
  }
  return proposalPairClock(offer.confirmedAt, jobCard.createdAt, referenceNow);
}

export async function handleProposalPairTimeline(
  ctx: QueryCtx,
  args: { proposalId: string; queryId: string; referenceNow: number }
) {
  const access = await requireAnyPermission(ctx, [
    PERMISSIONS.VIEW_PROPOSALS,
    PERMISSIONS.MANAGE_JOB_CARDS,
  ]);
  const referenceNow = assertReferenceNow(args.referenceNow);
  const { link, proposal, query } = await loadVisiblePair(ctx, access, args);
  const [handoffRows, requestRows, decisionRows, confirmedOffer, jobCard] = await Promise.all([
    ctx.db
      .query("proposalQueryHandoffs")
      .withIndex("by_proposalId_queryId_revision", (q) =>
        q.eq("proposalId", proposal._id).eq("queryId", query._id)
      )
      .order("desc")
      .take(PAIR_TIMELINE_LIMIT + 1),
    ctx.db
      .query("proposalRevisionRequests")
      .withIndex("by_proposalId_queryId_requestedAt", (q) =>
        q.eq("proposalId", proposal._id).eq("queryId", query._id)
      )
      .order("desc")
      .take(PAIR_TIMELINE_LIMIT + 1),
    ctx.db
      .query("proposalQueryDecisions")
      .withIndex("by_proposalId_queryId_decidedAt", (q) =>
        q.eq("proposalId", proposal._id).eq("queryId", query._id)
      )
      .order("desc")
      .take(PAIR_TIMELINE_LIMIT + 1),
    ctx.db
      .query("confirmedOffers")
      .withIndex("by_queryId", (q) => q.eq("queryId", query._id))
      .first(),
    ctx.db
      .query("jobCards")
      .withIndex("by_queryId", (q) => q.eq("queryId", query._id))
      .first(),
  ]);
  const handoffs = capped(handoffRows);
  const requests = capped(requestRows);
  const decisions = capped(decisionRows);
  const pairOffer = confirmedOffer?.proposalId === proposal._id ? confirmedOffer : null;
  const pairJobCard = jobCard?.proposalId === proposal._id ? jobCard : null;
  const events = buildProposalTimelineEvents({
    decisions: decisions.rows,
    handoffs: handoffs.rows,
    jobCard: pairJobCard,
    offer: pairOffer,
    proposal,
    requests: requests.rows,
  });

  const [latestHandoff] = [...handoffs.rows].sort((a, b) => b.handedOffAt - a.handedOffAt);
  const exactDecision = latestHandoff
    ? decisions.rows.find((decision) => decision.handoffId === latestHandoff._id)
    : undefined;
  const confirmationEnd =
    latestHandoff && pairOffer?.proposalQueryHandoffId === latestHandoff._id
      ? pairOffer.confirmedAt
      : undefined;
  const terminalWithoutExactClock =
    ["Order Confirmed", "Order Lost"].includes(query.salesStatus) &&
    !(exactDecision || confirmationEnd);
  const [latestRequest] = [...requests.rows].sort((a, b) => b.requestedAt - a.requestedAt);
  const confirmationToJobCard = exactConfirmationToJobCardClock(
    pairOffer,
    pairJobCard,
    referenceNow
  );

  return {
    clocks: {
      confirmationToJobCard,
      handoffToDecision: terminalWithoutExactClock
        ? unknownClock()
        : proposalPairClock(
            latestHandoff?.handedOffAt,
            exactDecision?.decidedAt ?? confirmationEnd,
            referenceNow
          ),
      revisionRequestToHandoff: latestRequest
        ? proposalPairClock(latestRequest.requestedAt, latestRequest.resolvedAt, referenceNow)
        : unknownClock(),
    },
    commercialPreflight: {
      exactRevisionCurrent:
        link.handedOffRevision !== undefined &&
        link.handedOffRevision === (proposal.proposalRevision ?? 1),
      pricingComplete: (proposal.costPrice ?? 0) > 0 && (proposal.sellingPrice ?? 0) > 0,
      proposalDocument: proposal.finalizedPdfStorageId ? "Optional document present" : "Optional",
    },
    events,
    pairState: deriveProposalPairState({
      currentProposalRevision: proposal.proposalRevision ?? 1,
      decisionRevision: link.decisionRevision,
      decisionStatus: link.decisionStatus,
      handedOffAt: link.handedOffAt,
      handedOffRevision: link.handedOffRevision,
      revisionRequestedAt: link.revisionRequestedAt,
    }),
    proposalCode: proposal.proposalCode,
    proposalId: proposal._id,
    queryCode: query.queryCode,
    queryId: query._id,
    truncated: handoffs.truncated || requests.truncated || decisions.truncated,
  };
}
