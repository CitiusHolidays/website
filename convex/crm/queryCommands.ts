import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { RuntimeObject } from "../lib/runtimeValues";
import { resolveCommandReceipt, storeCommandReceipt } from "./commandReceipts";
import { snapshotNewlyConfirmedOffer } from "./confirmedOffer";
import { scheduleCrmMetricSync } from "./financeMetricSync";
import {
  assertCementQueryTypeAllowed,
  assertDateRangeOrder,
  assertMaxWordCount,
  canSeeQueryRecord,
  createActivity,
  MAX_QUERY_NOTES_WORDS,
  PERMISSIONS,
  publishWorkflowNotification,
  requireHeadOrAdmin,
  requireStaff,
} from "./lib";
import { patchWithE2eOwnership } from "./lib/e2eOwnership";
import { buildQueryListSearchText, markListSearchDirty } from "./listSearch";
import { refreshProposalLinkProjections } from "./proposalLinkProjection";
import { resolveSalesOwnerSelection } from "./queryCreation";
import {
  notifyAssignedQueryOwners,
  notifyJobCardCreators,
  notifyOrderConfirmedWorkflow,
  notifyQueryAssignmentHeads,
  notifyQueryOwner,
} from "./queryNotifications";
import {
  assertConfirmedQueryIsTerminal,
  assertRevisionHasActualChange,
  assertSalesDecisionFieldsAllowed,
  buildContractingProgressPatch,
  buildQueryStatusNotificationPlan,
  buildSalesDecisionPatch,
  type ContractingProgressCommand,
  type SalesDecisionCommand,
} from "./queryStatusPolicy";

export { handleQueryCreate } from "./queryCreation";

export function assertInboundQuerySourceUnchanged(
  current: Pick<Doc<"queries">, "inboundIntentId" | "source">,
  nextSource: string | undefined
) {
  if (current.inboundIntentId && nextSource !== undefined && nextSource !== current.source) {
    throw new ConvexError("Inbound Query source is immutable");
  }
}

export async function handleQueryUpdate(
  ctx: MutationCtx,
  args: {
    batchingNotes?: string;
    budgetAmount?: number;
    clientName?: string;
    contactMobile?: string;
    contactPerson?: string;
    destination?: string;
    notes?: string;
    paxCount?: number;
    queryId: string;
    queryType?: string;
    salesOwnerName?: string;
    salesOwnerStaffId?: string;
    source?: string;
    travelEndDate?: string;
    travelInBatches?: boolean;
    travelStartDate?: string;
    travelType?: string;
  }
) {
  const access = await requireStaff(ctx, PERMISSIONS.MANAGE_QUERIES);
  const queryId = ctx.db.normalizeId("queries", args.queryId);
  if (!queryId) {
    throw new ConvexError("Invalid query id");
  }
  const current = await ctx.db.get("queries", queryId);
  if (!current) {
    throw new ConvexError("Query not found");
  }
  if (!canSeeQueryRecord(access, current)) {
    throw new ConvexError("FORBIDDEN");
  }
  assertInboundQuerySourceUnchanged(current, args.source);
  if (args.clientName !== undefined && !args.clientName.trim()) {
    throw new ConvexError("Client name is required");
  }
  if (args.paxCount !== undefined && args.paxCount < 1) {
    throw new ConvexError("Pax count must be greater than zero");
  }
  assertMaxWordCount(args.notes, MAX_QUERY_NOTES_WORDS, "Notes");
  if (args.queryType !== undefined) {
    assertCementQueryTypeAllowed(access, args.queryType);
  }
  assertDateRangeOrder(
    args.travelStartDate ?? current.travelStartDate,
    args.travelEndDate ?? current.travelEndDate,
    "Travel start date",
    "Travel end date"
  );

  const patch: RuntimeObject = { updatedAt: Date.now() };
  if (args.clientName !== undefined) {
    patch.clientName = args.clientName.trim();
  }
  if (args.contactPerson !== undefined) {
    patch.contactPerson = args.contactPerson.trim();
  }
  if (args.contactMobile !== undefined) {
    patch.contactMobile = args.contactMobile.trim();
  }
  if (args.destination !== undefined) {
    patch.destination = args.destination.trim();
  }
  if (args.paxCount !== undefined) {
    patch.paxCount = args.paxCount;
  }
  if (args.travelStartDate !== undefined) {
    patch.travelStartDate = args.travelStartDate;
  }
  if (args.travelEndDate !== undefined) {
    patch.travelEndDate = args.travelEndDate;
  }
  if (args.queryType !== undefined) {
    patch.queryType = args.queryType;
  }
  if (args.travelType !== undefined) {
    patch.travelType = args.travelType;
  }
  if (args.budgetAmount !== undefined) {
    patch.budgetAmount = Math.max(args.budgetAmount, 0);
  }
  if (args.source !== undefined) {
    patch.source = args.source;
  }
  if (args.salesOwnerName !== undefined || args.salesOwnerStaffId !== undefined) {
    const salesOwnerStaff = await resolveSalesOwnerSelection(
      ctx,
      access,
      args.salesOwnerStaffId,
      args.salesOwnerName
    );
    patch.salesOwnerId = salesOwnerStaff.authUserId;
    patch.salesOwnerName = salesOwnerStaff.name.trim();
  }
  if (args.travelInBatches !== undefined) {
    patch.travelInBatches = args.travelInBatches;
  }
  if (args.batchingNotes !== undefined) {
    patch.batchingNotes = args.batchingNotes.trim();
  }
  if (args.notes !== undefined) {
    patch.notes = args.notes.trim();
  }
  patch.listSearchText = buildQueryListSearchText({ ...current, ...patch });

  await patchWithE2eOwnership(ctx, "queries", queryId, patch);
  await markListSearchDirty(ctx, "queries", String(queryId));
  await scheduleCrmMetricSync(ctx, "queries", String(queryId));
  await refreshProposalLinkProjections(ctx, queryId);
  await createActivity(ctx, access, {
    action: "updated",
    entityId: queryId,
    entityType: "query",
    message: `${current.queryCode} updated`,
  });
  return { id: queryId };
}

export async function handleAssignJobCardCreator(
  ctx: MutationCtx,
  args: {
    queryId: string;
    staffId: string;
  }
) {
  const access = await requireHeadOrAdmin(ctx, ["Accounts Head"]);
  const queryId = ctx.db.normalizeId("queries", args.queryId);
  if (!queryId) {
    throw new ConvexError("Invalid query id");
  }
  const query = await ctx.db.get("queries", queryId);
  if (!query) {
    throw new ConvexError("Query not found");
  }
  if (!canSeeQueryRecord(access, query)) {
    throw new ConvexError("FORBIDDEN");
  }
  if (query.salesStatus !== "Order Confirmed" && query.contractingStatus !== "Order Confirmed") {
    throw new ConvexError("Assign a Job Card creator only after order confirmation");
  }
  const staffId = ctx.db.normalizeId("staffUsers", args.staffId);
  if (!staffId) {
    throw new ConvexError("Invalid staff id");
  }
  const staff = await ctx.db.get("staffUsers", staffId);
  if (!staff?.active) {
    throw new ConvexError("Staff member not found");
  }
  if (!staff.roles.some((role) => ["Accounts", "Accounts Head"].includes(role))) {
    throw new ConvexError("Selected staff member is not in Accounts");
  }
  const now = Date.now();
  await Promise.all([
    patchWithE2eOwnership(ctx, "queries", queryId, {
      jobCardCreatorName: staff.name.trim(),
      jobCardCreatorStaffId: staffId,
      updatedAt: now,
    }),
    createActivity(ctx, access, {
      action: "assigned_job_card_creator",
      entityId: queryId,
      entityType: "query",
      message: `${query.queryCode} Job Card creator assigned to ${staff.name.trim()}`,
    }),
    publishWorkflowNotification(ctx, {
      bellTargets: { kind: "staff", staffIds: [staffId] },
      content: {
        body: `${query.queryCode} is assigned to you for Job Card creation.`,
        entityId: queryId,
        entityType: "query",
        title: "Job Card assigned",
      },
      emailTargets: { kind: "staff", staffIds: [staffId] },
    }),
  ]);
  await scheduleCrmMetricSync(ctx, "queries", String(queryId));
  return { id: queryId };
}

export async function handleSubmitToContracting(
  ctx: MutationCtx,
  args: {
    queryId: string;
  }
) {
  const access = await requireStaff(ctx, PERMISSIONS.MANAGE_QUERIES);
  const queryId = ctx.db.normalizeId("queries", args.queryId);
  if (!queryId) {
    throw new ConvexError("Invalid query id");
  }
  const current = await ctx.db.get("queries", queryId);
  if (!current) {
    throw new ConvexError("Query not found");
  }
  if (!canSeeQueryRecord(access, current)) {
    throw new ConvexError("FORBIDDEN");
  }
  const now = Date.now();
  await patchWithE2eOwnership(ctx, "queries", queryId, {
    contractingStatus: "Query Received",
    leadStage: current.leadStage === "Inquiry" ? "Proposal" : current.leadStage,
    submittedToContractingAt: now,
    updatedAt: now,
  });
  await scheduleCrmMetricSync(ctx, "queries", String(queryId));
  await refreshProposalLinkProjections(ctx, queryId);
  const hasAssignedTeam = Boolean(
    current.contractingOwnerId || current.ticketingOwnerId || current.ticketingScope
  );
  await Promise.all([
    createActivity(ctx, access, {
      action: "submitted_to_contracting",
      entityId: queryId,
      entityType: "query",
      message: `${current.queryCode} submitted to Contracting`,
    }),
    notifyQueryAssignmentHeads(ctx, current, {
      body: hasAssignedTeam
        ? `${current.queryCode} was submitted by Sales and is ready for assigned proposal work.`
        : `${current.queryCode} was submitted by Sales. Review and assign contracting and ticketing teams.`,
      entityId: queryId,
      entityType: "query",
      title: hasAssignedTeam ? "Query submitted to Contracting" : "Query ready for assignment",
    }),
    ...(hasAssignedTeam ? [notifyAssignedQueryOwners(ctx, current, queryId)] : []),
  ]);
  return { id: queryId };
}

export async function handleUpdateContractingProgress(
  ctx: MutationCtx,
  args: ContractingProgressCommand
) {
  const access = await requireStaff(ctx, PERMISSIONS.MANAGE_CONTRACTING);
  const queryId = ctx.db.normalizeId("queries", args.queryId);
  if (!queryId) {
    throw new ConvexError("Invalid query id");
  }
  const current = await ctx.db.get("queries", queryId);
  if (!current) {
    throw new ConvexError("Query not found");
  }
  if (!canSeeQueryRecord(access, current)) {
    throw new ConvexError("FORBIDDEN");
  }

  assertConfirmedQueryIsTerminal(current, args);
  const now = Date.now();
  const patch = buildContractingProgressPatch({ args, now });
  await patchWithE2eOwnership(ctx, "queries", queryId, patch);
  await scheduleCrmMetricSync(ctx, "queries", String(queryId));
  await Promise.all([
    refreshProposalLinkProjections(ctx, queryId),
    createActivity(ctx, access, {
      action: "contracting_progress_updated",
      entityId: queryId,
      entityType: "query",
      message: `${current.queryCode} contracting progress updated`,
      metadata: patch,
    }),
  ]);
  return { id: queryId };
}

export async function handleApplySalesDecision(ctx: MutationCtx, args: SalesDecisionCommand) {
  const access = await requireStaff(ctx, PERMISSIONS.MANAGE_QUERIES);
  assertSalesDecisionFieldsAllowed(args);
  const queryId = ctx.db.normalizeId("queries", args.queryId);
  if (!queryId) {
    throw new ConvexError("Invalid query id");
  }
  const { commandId: _commandId, ...commandPayload } = args;
  const current = await ctx.db.get("queries", queryId);
  if (!current) {
    throw new ConvexError("Query not found");
  }
  if (!canSeeQueryRecord(access, current)) {
    throw new ConvexError("FORBIDDEN");
  }
  const confirmationRequested = args.salesStatus === "Order Confirmed";
  const receipt =
    confirmationRequested && args.commandId
      ? await resolveCommandReceipt(ctx, {
          access,
          commandId: args.commandId,
          operation: "query.order_confirmed.v2",
          payload: commandPayload,
          targetId: String(queryId),
        })
      : null;
  if (receipt?.replayedResultId) {
    const replayedId = ctx.db.normalizeId("queries", receipt.replayedResultId);
    if (!replayedId) {
      throw new ConvexError("Stored command result is no longer valid");
    }
    return { id: replayedId };
  }

  assertConfirmedQueryIsTerminal(current, args);
  assertRevisionHasActualChange(current, args);
  assertDateRangeOrder(
    args.travelStartDate ?? current.travelStartDate,
    args.travelEndDate ?? current.travelEndDate,
    "Travel start date",
    "Travel end date"
  );
  const now = Date.now();
  const patch = buildSalesDecisionPatch({ args, now });
  const isNewlyConfirmed = args.salesStatus === "Order Confirmed";

  const confirmedOfferId = await snapshotNewlyConfirmedOffer(ctx, access, current, args, now);
  if (confirmedOfferId) {
    patch.confirmedOfferId = confirmedOfferId;
    patch.acceptedProposalId = ctx.db.normalizeId("proposals", args.proposalId ?? "") ?? undefined;
  }

  await patchWithE2eOwnership(ctx, "queries", queryId, patch);
  await scheduleCrmMetricSync(ctx, "queries", String(queryId));
  await refreshProposalLinkProjections(ctx, queryId);

  const isLost = args.salesStatus === "Order Lost";
  const notificationPlan = buildQueryStatusNotificationPlan({
    args,
    current,
    isNewlyConfirmed,
    wasConfirmed: false,
  });
  let activityAction = "status_updated";
  if (isNewlyConfirmed) {
    activityAction = "confirmed";
  } else if (isLost) {
    activityAction = "lost";
  }

  await Promise.all([
    createActivity(ctx, access, {
      action: activityAction,
      entityId: queryId,
      entityType: "query",
      message: `${current.queryCode} status updated`,
      metadata: { ...patch, confirmedOfferId },
    }),
    ...(notificationPlan.notifyJobCardCreators
      ? [notifyJobCardCreators(ctx, current, queryId)]
      : []),
    ...(notificationPlan.notifyOrderConfirmedWorkflow
      ? [notifyOrderConfirmedWorkflow(ctx, current, queryId)]
      : []),
    ...notificationPlan.roleNotifications.map((notification) =>
      publishWorkflowNotification(ctx, {
        bellTargets: { kind: "roles", roles: notification.roles },
        content: {
          body: notification.body,
          entityId: queryId,
          entityType: "query",
          title: notification.title,
        },
        emailTargets: {
          kind: "roles",
          roles: notification.emailRoles ?? notification.roles,
        },
      })
    ),
    ...notificationPlan.ownerNotifications.map((notification) =>
      notifyQueryOwner(ctx, notification.ownerId, {
        body: notification.body,
        entityId: queryId,
        entityType: "query",
        title: notification.title,
      })
    ),
  ]);

  if (receipt && args.commandId) {
    await storeCommandReceipt(ctx, {
      actorKey: receipt.actorKey,
      commandId: args.commandId,
      operation: "query.order_confirmed.v2",
      payloadDigest: receipt.payloadDigest,
      resultId: String(queryId),
      targetId: String(queryId),
    });
  }

  return { id: queryId };
}

export async function handleQueryUpdateStatus(): Promise<never> {
  throw new ConvexError(
    "updateStatus is retired. Use applySalesDecision or updateContractingProgress."
  );
}
