import {
  type PaginationOptions,
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { ConvexError, type Infer, v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { query } from "../_generated/server";
import { getVisibleJob } from "./importProcessor";
import { canReceiveNotification } from "./lib/notifications";
import { PERMISSIONS } from "./lib/rolePolicy";
import { type PortalAccess, requireStaff } from "./lib/staffAccess";
import {
  canReceiveNotificationEmailOrigin,
  canViewNotificationEmailDeliverySummary,
} from "./notificationEmailLedger";
import { getNotificationHref } from "./notificationPaths";
import { isOperationStalled, OPERATION_STALL_THRESHOLD_MS } from "./operationTimePolicy";
import {
  boundedPaginationOptions,
  compactPageItems,
  mapInBoundedBatches,
} from "./paginationPolicy";
import { isPassengerExportCommandId } from "./passengerExportPolicy";
import {
  canManagePassengerKinds,
  canViewPassengerKinds,
  isPassengerKind,
} from "./passengerKindPolicy";
import { assertReferenceNow } from "./referenceTimePolicy";
import { isNudgeRunStale, WORKFLOW_NUDGE_MAX_RETRIES } from "./workflowNudgeRun";
import { canManageWorkflowRules } from "./workflowNudges";

export const RECOVERY_SOURCES = [
  "passenger_import",
  "passenger_export",
  "job_card_deletion",
  "notification_email",
  "workflow_nudge",
] as const;

export type RecoverySource = (typeof RECOVERY_SOURCES)[number];

export const recoverySourceValidator = v.union(
  v.literal("passenger_import"),
  v.literal("passenger_export"),
  v.literal("job_card_deletion"),
  v.literal("notification_email"),
  v.literal("workflow_nudge")
);

const recoveryStatusValidator = v.union(
  v.literal("partial"),
  v.literal("retryable"),
  v.literal("exhausted"),
  v.literal("stale"),
  v.literal("failed")
);

const recoveryReadinessValidator = v.union(
  v.literal("manual_review"),
  v.literal("retry_available"),
  v.literal("retry_exhausted"),
  v.literal("retrying"),
  v.literal("source_required")
);

const recoveryRetryValidator = v.object({
  commandId: v.string(),
  exportKind: v.union(
    v.literal("passenger"),
    v.literal("traveller"),
    v.literal("rooming"),
    v.literal("passport"),
    v.literal("visa")
  ),
  jobCardId: v.id("jobCards"),
  kind: v.literal("passenger_export"),
});

export const recoveryItemValidator = v.object({
  ageMs: v.number(),
  freshness: v.union(v.literal("recent"), v.literal("aged")),
  href: v.string(),
  id: v.string(),
  owner: v.object({
    kind: v.union(
      v.literal("initiator"),
      v.literal("job_card_admin"),
      v.literal("notification_owner"),
      v.literal("workflow_admin")
    ),
    label: v.string(),
  }),
  readiness: recoveryReadinessValidator,
  retry: v.optional(recoveryRetryValidator),
  source: recoverySourceValidator,
  status: recoveryStatusValidator,
  summary: v.string(),
  updatedAt: v.number(),
});

export type RecoveryItem = Infer<typeof recoveryItemValidator>;

export function recoveryAgeMs(updatedAt: number, referenceNow: number) {
  return Math.max(0, referenceNow - updatedAt);
}

export function recoveryFreshness(updatedAt: number, referenceNow: number) {
  return recoveryAgeMs(updatedAt, referenceNow) > OPERATION_STALL_THRESHOLD_MS
    ? ("aged" as const)
    : ("recent" as const);
}

function recoveryBase(args: {
  href: string;
  id: string;
  owner: RecoveryItem["owner"];
  readiness: RecoveryItem["readiness"];
  referenceNow: number;
  source: RecoverySource;
  status: RecoveryItem["status"];
  summary: string;
  updatedAt: number;
}) {
  return {
    ageMs: recoveryAgeMs(args.updatedAt, args.referenceNow),
    freshness: recoveryFreshness(args.updatedAt, args.referenceNow),
    href: args.href,
    id: `${args.source}:${args.id}`,
    owner: args.owner,
    readiness: args.readiness,
    source: args.source,
    status: args.status,
    summary: args.summary,
    updatedAt: args.updatedAt,
  };
}

export function projectPassengerImportRecoveryItem(
  operation: Doc<"passengerImportOperations">,
  jobCode: string,
  referenceNow: number
): RecoveryItem | null {
  const stalled = isOperationStalled(operation.status, operation.updatedAt, referenceNow);
  if (!(operation.status === "partial" || stalled)) {
    return null;
  }
  return {
    ...recoveryBase({
      href: `/portal/job-cards/${encodeURIComponent(String(operation.jobCardId))}`,
      id: String(operation._id),
      owner: { kind: "initiator", label: "Initiating staff member" },
      readiness: "source_required",
      referenceNow,
      source: "passenger_import",
      status: stalled ? "stale" : "partial",
      summary: `Passenger import for ${jobCode} has ${operation.remaining} unresolved of ${operation.total} rows. Reopen the original workbook to continue.`,
      updatedAt: operation.updatedAt,
    }),
  };
}

export function projectPassengerExportRecoveryItem(
  operation: Doc<"passengerExportOperations">,
  jobCode: string,
  referenceNow: number
): RecoveryItem | null {
  const stalled = isOperationStalled(operation.status, operation.updatedAt, referenceNow);
  if (!(isPassengerKind(operation.exportKind) && (operation.status === "failed" || stalled))) {
    return null;
  }
  const replaySafe = isPassengerExportCommandId(operation.commandId);
  let status: RecoveryItem["status"] = stalled ? "stale" : "failed";
  if (replaySafe && !stalled) {
    status = "retryable";
  }
  const item = recoveryBase({
    href: `/portal/job-cards/${encodeURIComponent(String(operation.jobCardId))}`,
    id: String(operation._id),
    owner: { kind: "initiator", label: "Initiating staff member" },
    readiness: replaySafe ? "retry_available" : "manual_review",
    referenceNow,
    source: "passenger_export",
    status,
    summary: `${jobCode} ${operation.exportKind} export stopped after ${operation.rowsProcessed} rows.`,
    updatedAt: operation.updatedAt,
  });
  if (!replaySafe) {
    return item;
  }
  return {
    ...item,
    retry: {
      commandId: operation.commandId,
      exportKind: operation.exportKind,
      jobCardId: operation.jobCardId,
      kind: "passenger_export",
    },
  };
}

export function projectJobCardDeletionRecoveryItem(
  operation: Doc<"jobCardDeletionOperations">,
  referenceNow: number
): RecoveryItem | null {
  const stalled = isOperationStalled(operation.status, operation.lastProgressAt, referenceNow);
  if (!(operation.status === "failed" || stalled)) {
    return null;
  }
  return {
    ...recoveryBase({
      href: "/portal/job-cards#deletion-status",
      id: String(operation._id),
      owner: { kind: "job_card_admin", label: "Job Card admin" },
      readiness: "manual_review",
      referenceNow,
      source: "job_card_deletion",
      status: stalled ? "stale" : "failed",
      summary: `Cleanup for ${operation.jobCode} stopped after removing ${operation.deletedCount} records.`,
      updatedAt: operation.lastProgressAt,
    }),
  };
}

export function projectWorkflowNudgeRecoveryItem(
  run: Doc<"portalWorkflowNudgeRuns">,
  referenceNow: number
): RecoveryItem | null {
  const effectiveStale = run.status === "stale" || isNudgeRunStale(run, referenceNow);
  if (!(run.status === "failed" || effectiveStale)) {
    return null;
  }
  const retriesExhausted = (run.retryCount ?? 0) >= WORKFLOW_NUDGE_MAX_RETRIES;
  let status: RecoveryItem["status"] = "retryable";
  if (retriesExhausted) {
    status = "exhausted";
  } else if (effectiveStale) {
    status = "stale";
  }
  return recoveryBase({
    href: "/portal/recovery#workflow-automation",
    id: String(run._id),
    owner: { kind: "workflow_admin", label: "Workflow admin" },
    readiness: retriesExhausted ? "retry_exhausted" : "manual_review",
    referenceNow,
    source: "workflow_nudge",
    status,
    summary: `Workflow reminders stopped after checking ${run.checked} records and queuing ${run.sent} notifications.`,
    updatedAt: run.updatedAt,
  });
}

function projectNotificationEmailRecoveryItem(args: {
  href: string;
  label: string;
  referenceNow: number;
  summary: Doc<"notificationEmailEventSummaries">;
}): RecoveryItem | null {
  if (!(args.summary.exhausted > 0 || args.summary.retrying > 0)) {
    return null;
  }
  const exhausted = args.summary.exhausted > 0;
  return {
    ...recoveryBase({
      href: args.href,
      id: String(args.summary._id),
      owner: { kind: "notification_owner", label: "Notification owner" },
      readiness: exhausted ? "manual_review" : "retrying",
      referenceNow: args.referenceNow,
      source: "notification_email",
      status: exhausted ? "exhausted" : "retryable",
      summary: `${args.label}: ${args.summary.exhausted} exhausted and ${args.summary.retrying} retrying of ${args.summary.total} email deliveries.`,
      updatedAt: args.summary.updatedAt,
    }),
  };
}

function recoveryPage<Item>(
  page: {
    continueCursor: string;
    isDone: boolean;
    page: Item[];
    pageStatus?: "SplitRecommended" | "SplitRequired" | null;
  },
  items: Array<RecoveryItem | null>
) {
  return { ...page, page: compactPageItems(items) };
}

async function listPassengerImports(
  ctx: QueryCtx,
  access: PortalAccess,
  initiatedBy: string,
  paginationOpts: PaginationOptions,
  referenceNow: number
) {
  const page = await ctx.db
    .query("passengerImportOperations")
    .withIndex("by_initiatedBy_updatedAt", (q) => q.eq("initiatedBy", initiatedBy))
    .order("desc")
    .paginate(boundedPaginationOptions(paginationOpts));
  const items = await mapInBoundedBatches(page.page, async (operation) => {
    if (!canManagePassengerKinds(access, operation.importKinds)) {
      return null;
    }
    const job = await getVisibleJob(ctx, access, operation.jobCardId);
    return job ? projectPassengerImportRecoveryItem(operation, job.jobCode, referenceNow) : null;
  });
  return recoveryPage(page, items);
}

async function listPassengerExports(
  ctx: QueryCtx,
  access: PortalAccess,
  initiatedBy: string,
  paginationOpts: PaginationOptions,
  referenceNow: number
) {
  const page = await ctx.db
    .query("passengerExportOperations")
    .withIndex("by_initiatedBy_updatedAt", (q) => q.eq("initiatedBy", initiatedBy))
    .order("desc")
    .paginate(boundedPaginationOptions(paginationOpts));
  const items = await mapInBoundedBatches(page.page, async (operation) => {
    if (!canViewPassengerKinds(access, [operation.exportKind])) {
      return null;
    }
    const job = await getVisibleJob(ctx, access, operation.jobCardId);
    return job ? projectPassengerExportRecoveryItem(operation, job.jobCode, referenceNow) : null;
  });
  return recoveryPage(page, items);
}

async function listJobCardDeletions(
  ctx: QueryCtx,
  access: PortalAccess,
  initiatedBy: string,
  paginationOpts: PaginationOptions,
  referenceNow: number
) {
  if (!access.permissions.includes(PERMISSIONS.MANAGE_JOB_CARDS)) {
    throw new ConvexError("FORBIDDEN");
  }
  const page = await ctx.db
    .query("jobCardDeletionOperations")
    .withIndex("by_initiatedBy_startedAt", (q) => q.eq("initiatedBy", initiatedBy))
    .order("desc")
    .paginate(boundedPaginationOptions(paginationOpts));
  return recoveryPage(
    page,
    page.page.map((operation) => projectJobCardDeletionRecoveryItem(operation, referenceNow))
  );
}

async function authorizedEmailOrigin(
  ctx: QueryCtx,
  access: PortalAccess,
  eventId: string
): Promise<{ href: string; label: string } | null> {
  const notificationId = ctx.db.normalizeId("notifications", eventId);
  const notification = notificationId ? await ctx.db.get("notifications", notificationId) : null;
  if (notification && canReceiveNotification(notification, access)) {
    return {
      href: getNotificationHref({
        entityId: notification.entityId,
        entityType: notification.entityType,
        title: notification.title,
      }),
      label: "Notification email",
    };
  }
  const origin = await ctx.db
    .query("notificationEmailEventOrigins")
    .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
    .unique();
  if (!(origin && canReceiveNotificationEmailOrigin(origin, access))) {
    return null;
  }
  return {
    href: getNotificationHref({
      entityId: origin.entityId,
      entityType: origin.entityType,
      title: origin.label,
    }),
    label: "Notification email",
  };
}

async function listNotificationEmails(
  ctx: QueryCtx,
  access: PortalAccess,
  paginationOpts: PaginationOptions,
  referenceNow: number
) {
  if (!canViewNotificationEmailDeliverySummary(access)) {
    throw new ConvexError("FORBIDDEN");
  }
  const page = await ctx.db
    .query("notificationEmailEventSummaries")
    .withIndex("by_updatedAt")
    .order("desc")
    .paginate(boundedPaginationOptions(paginationOpts));
  const items = await mapInBoundedBatches(page.page, async (summary) => {
    const origin = await authorizedEmailOrigin(ctx, access, summary.eventId);
    return origin
      ? projectNotificationEmailRecoveryItem({ ...origin, referenceNow, summary })
      : null;
  });
  return recoveryPage(page, items);
}

async function listWorkflowNudges(
  ctx: QueryCtx,
  access: PortalAccess,
  paginationOpts: PaginationOptions,
  referenceNow: number
) {
  if (!canManageWorkflowRules(access)) {
    throw new ConvexError("FORBIDDEN");
  }
  const page = await ctx.db
    .query("portalWorkflowNudgeRuns")
    .order("desc")
    .paginate(boundedPaginationOptions(paginationOpts));
  return recoveryPage(
    page,
    page.page.map((run) => projectWorkflowNudgeRecoveryItem(run, referenceNow))
  );
}

export const listItems = query({
  args: {
    paginationOpts: paginationOptsValidator,
    referenceNow: v.number(),
    source: recoverySourceValidator,
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.VIEW_DASHBOARD);
    const referenceNow = assertReferenceNow(args.referenceNow);
    const initiatedBy = access.authUserId ?? access.email;
    switch (args.source) {
      case "passenger_import":
        return await listPassengerImports(
          ctx,
          access,
          initiatedBy,
          args.paginationOpts,
          referenceNow
        );
      case "passenger_export":
        return await listPassengerExports(
          ctx,
          access,
          initiatedBy,
          args.paginationOpts,
          referenceNow
        );
      case "job_card_deletion":
        return await listJobCardDeletions(
          ctx,
          access,
          initiatedBy,
          args.paginationOpts,
          referenceNow
        );
      case "notification_email":
        return await listNotificationEmails(ctx, access, args.paginationOpts, referenceNow);
      case "workflow_nudge":
        return await listWorkflowNudges(ctx, access, args.paginationOpts, referenceNow);
      default:
        throw new ConvexError("Unknown recovery source");
    }
  },
  returns: paginationResultValidator(recoveryItemValidator),
});
