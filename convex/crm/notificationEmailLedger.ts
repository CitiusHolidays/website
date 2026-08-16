import { makeFunctionReference } from "convex/server";
import { ConvexError, type Value, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { internalAction, internalMutation, type MutationCtx, query } from "../_generated/server";
import {
  isRuntimeNumber,
  isRuntimeObject,
  isRuntimeString,
  propertiesWhen,
} from "../lib/runtimeValues";
import { canReceiveNotification } from "./lib/notifications";
import { PERMISSIONS } from "./lib/rolePolicy";
import { requireStaff } from "./lib/staffAccess";
import { getNotificationHref } from "./notificationPaths";

export const NOTIFICATION_EMAIL_DELIVERY_STATUSES = [
  "queued",
  "sending",
  "retrying",
  "sent",
  "skipped",
  "exhausted",
] as const;

const deliveryStatus = v.union(
  v.literal("queued"),
  v.literal("sending"),
  v.literal("retrying"),
  v.literal("sent"),
  v.literal("skipped"),
  v.literal("exhausted")
);

export type DeliveryStatus = (typeof NOTIFICATION_EMAIL_DELIVERY_STATUSES)[number];

const DELIVERY_SUMMARY_VERSION = 1;
const DELIVERY_SUMMARY_READINESS_KEY = "notificationEmailDeliveries";
const DELIVERY_SUMMARY_PAGE_SIZE = 50;
const DELIVERY_SUMMARY_RECONCILIATION_STALE_MS = 60 * 60 * 1000;

type SummaryReconciliationStage = "backfill" | "verify";

interface SummaryReconciliationPageArgs extends Record<string, Value> {
  cursor: string | null;
  generation: number;
  residuals: number;
  scanned: number;
  stage: SummaryReconciliationStage;
}

const reconcileDeliverySummaryPageRef = makeFunctionReference<
  "mutation",
  SummaryReconciliationPageArgs,
  null
>("crm/notificationEmailLedger:reconcileDeliverySummaryPage");

export function canViewNotificationEmailDeliverySummary(access: {
  roles: string[];
  allowed: boolean;
  permissions: string[];
  email: string;
  name: string;
}) {
  return access.allowed && access.permissions.includes(PERMISSIONS.VIEW_EMAIL_DELIVERY_STATUS);
}

const DELIVERY_STATUS_RANK = {
  exhausted: 3,
  queued: 0,
  retrying: 2,
  sending: 1,
  sent: 4,
  skipped: 3,
} satisfies Record<DeliveryStatus, number>;
const RECIPIENT_HASH_PATTERN = /^[a-z0-9-]{8,128}$/i;
const MAX_LEDGER_WRITE_ATTEMPTS = 5;

interface DeliverySummaryCounts {
  exhausted: number;
  queued: number;
  retrying: number;
  sending: number;
  sent: number;
  skipped: number;
}

interface DeliveryProjectionSource {
  eventId: string;
  status: DeliveryStatus;
  summaryProjectedEventId?: string;
  summaryProjectedStatus?: DeliveryStatus;
}

interface DeliverySummaryDelta {
  counts: DeliverySummaryCounts;
  eventId: string;
  total: number;
}

function emptyDeliverySummaryCounts(): DeliverySummaryCounts {
  return {
    exhausted: 0,
    queued: 0,
    retrying: 0,
    sending: 0,
    sent: 0,
    skipped: 0,
  };
}

export function hasValidNotificationSummaryProjectionMarker(row: DeliveryProjectionSource) {
  return (
    (row.summaryProjectedEventId === undefined && row.summaryProjectedStatus === undefined) ||
    (row.summaryProjectedEventId !== undefined && row.summaryProjectedStatus !== undefined)
  );
}

/**
 * Describe the aggregate transition separately from database I/O so replay,
 * event moves, and status changes are independently testable.
 */
export function notificationSummaryProjectionDeltas(
  existing: DeliveryProjectionSource | null,
  incoming: Pick<DeliveryProjectionSource, "eventId" | "status">
): DeliverySummaryDelta[] {
  if (existing && !hasValidNotificationSummaryProjectionMarker(existing)) {
    throw new ConvexError("NOTIFICATION_EMAIL_PROJECTION_INVALID");
  }
  const deltas = new Map<string, DeliverySummaryDelta>();
  const add = (eventId: string, status: DeliveryStatus, count: number, total: number) => {
    const delta = deltas.get(eventId) ?? {
      counts: emptyDeliverySummaryCounts(),
      eventId,
      total: 0,
    };
    delta.counts[status] += count;
    delta.total += total;
    deltas.set(eventId, delta);
  };

  if (existing?.summaryProjectedEventId && existing.summaryProjectedStatus) {
    add(existing.summaryProjectedEventId, existing.summaryProjectedStatus, -1, -1);
  }
  add(incoming.eventId, incoming.status, 1, 1);
  return Array.from(deltas.values());
}

function summaryCountsFromRow(row: Doc<"notificationEmailEventSummaries"> | null) {
  return {
    exhausted: row?.exhausted ?? 0,
    queued: row?.queued ?? 0,
    retrying: row?.retrying ?? 0,
    sending: row?.sending ?? 0,
    sent: row?.sent ?? 0,
    skipped: row?.skipped ?? 0,
  } satisfies DeliverySummaryCounts;
}

async function applyDeliverySummaryProjection(
  ctx: MutationCtx,
  existing: DeliveryProjectionSource | null,
  incoming: Pick<DeliveryProjectionSource, "eventId" | "status">,
  updatedAt: number
) {
  const alreadyProjected = Boolean(
    existing?.summaryProjectedEventId === incoming.eventId &&
      existing.summaryProjectedStatus === incoming.status
  );
  const deltas = alreadyProjected
    ? [
        {
          counts: emptyDeliverySummaryCounts(),
          eventId: incoming.eventId,
          total: 0,
        },
      ]
    : notificationSummaryProjectionDeltas(existing, incoming);

  await Promise.all(
    deltas.map(async (delta) => {
      const summary = await ctx.db
        .query("notificationEmailEventSummaries")
        .withIndex("by_eventId", (q) => q.eq("eventId", delta.eventId))
        .unique();
      if (!summary && delta.total <= 0) {
        throw new ConvexError("NOTIFICATION_EMAIL_SUMMARY_MISSING");
      }
      const counts = summaryCountsFromRow(summary);
      for (const status of NOTIFICATION_EMAIL_DELIVERY_STATUSES) {
        counts[status] += delta.counts[status];
        if (!Number.isSafeInteger(counts[status]) || counts[status] < 0) {
          throw new ConvexError("NOTIFICATION_EMAIL_SUMMARY_INVALID");
        }
      }
      const total = (summary?.total ?? 0) + delta.total;
      if (
        !Number.isSafeInteger(total) ||
        total < 0 ||
        NOTIFICATION_EMAIL_DELIVERY_STATUSES.reduce((sum, status) => sum + counts[status], 0) !==
          total
      ) {
        throw new ConvexError("NOTIFICATION_EMAIL_SUMMARY_INVALID");
      }
      const patch = {
        ...counts,
        eventId: delta.eventId,
        total,
        updatedAt: Math.max(summary?.updatedAt ?? 0, updatedAt),
      };
      if (summary) {
        await ctx.db.patch("notificationEmailEventSummaries", summary._id, patch);
      } else {
        await ctx.db.insert("notificationEmailEventSummaries", patch);
      }
    })
  );
}

async function loadDeliverySummaryReadiness(ctx: MutationCtx) {
  return await ctx.db
    .query("notificationEmailSummaryReadiness")
    .withIndex("by_key", (q) => q.eq("key", DELIVERY_SUMMARY_READINESS_KEY))
    .unique();
}

async function scheduleDeliverySummaryPage(ctx: MutationCtx, args: SummaryReconciliationPageArgs) {
  await ctx.scheduler.runAfter(0, reconcileDeliverySummaryPageRef, args);
}

/**
 * Keep error data useful for operators without persisting provider response
 * bodies, addresses, subjects, or other message content.
 */
export function normalizeNotificationEmailFailure(cause: unknown) {
  if (!(cause && isRuntimeObject(cause))) {
    return { code: "unknown", providerStatus: undefined };
  }
  const candidate = {
    name: "name" in cause ? cause.name : undefined,
    statusCode: "statusCode" in cause ? cause.statusCode : undefined,
  };
  const statusCode =
    isRuntimeNumber(candidate.statusCode) && Number.isFinite(candidate.statusCode)
      ? Math.trunc(candidate.statusCode)
      : undefined;
  const name = isRuntimeString(candidate.name) ? candidate.name.toLowerCase() : "";
  if (statusCode === 429 || name === "rate_limit_exceeded") {
    return { code: "rate_limited", providerStatus: statusCode };
  }
  if (statusCode !== undefined && statusCode >= 500) {
    return { code: "provider_unavailable", providerStatus: statusCode };
  }
  if (["aborterror", "fetcherror", "networkerror", "timeouterror", "typeerror"].includes(name)) {
    return { code: "network_error", providerStatus: statusCode };
  }
  if (name === "invalid_recipient" || statusCode === 400) {
    return { code: "provider_rejected", providerStatus: statusCode };
  }
  return { code: "provider_error", providerStatus: statusCode };
}

export function notificationEmailRecipientHashFromIdempotencyKey(idempotencyKey: string) {
  const segments = idempotencyKey.split("/");
  const [last] = segments.slice(-1);
  return last ?? "unknown";
}

interface DeliveryRecord {
  _id: string;
  attempts: number;
  status: DeliveryStatus;
}

/**
 * Monotonic merge used by the Convex mutation and unit-tested independently
 * so scheduler replay cannot move a sent row back to queued/sending.
 */
export function shouldApplyDeliveryOutcome(
  existing: DeliveryRecord | null,
  incoming: { attempts: number; status: DeliveryStatus }
) {
  if (!existing) {
    return true;
  }
  if (existing.status === "sent" && incoming.status !== "sent") {
    return false;
  }
  if (incoming.attempts < existing.attempts) {
    return false;
  }
  if (incoming.attempts > existing.attempts) {
    return true;
  }
  return DELIVERY_STATUS_RANK[incoming.status] >= DELIVERY_STATUS_RANK[existing.status];
}

export const recordDeliveryOutcome = internalMutation({
  args: {
    attempts: v.number(),
    eventId: v.string(),
    failureCode: v.optional(v.string()),
    idempotencyKey: v.string(),
    providerStatus: v.optional(v.number()),
    recipientHash: v.string(),
    status: deliveryStatus,
  },
  handler: async (ctx, args) => {
    if (!Number.isInteger(args.attempts) || args.attempts < 0 || args.attempts > 100) {
      throw new ConvexError("Invalid notification email attempt count");
    }
    if (!RECIPIENT_HASH_PATTERN.test(args.recipientHash)) {
      throw new ConvexError("Invalid notification email recipient hash");
    }
    const now = Date.now();
    const existing = await ctx.db
      .query("notificationEmailDeliveries")
      .withIndex("by_deliveryKey", (q) => q.eq("idempotencyKey", args.idempotencyKey))
      .unique();

    if (existing && existing.eventId !== args.eventId) {
      throw new ConvexError("NOTIFICATION_EMAIL_EVENT_ID_MISMATCH");
    }

    if (
      existing &&
      !shouldApplyDeliveryOutcome(existing, { attempts: args.attempts, status: args.status })
    ) {
      return existing._id;
    }

    const patch = {
      attempts: Math.max(existing?.attempts ?? 0, args.attempts),
      eventId: args.eventId,
      failureCode: args.failureCode,
      providerStatus: args.providerStatus,
      recipientHash: args.recipientHash,
      status: args.status,
      updatedAt: now,
      ...propertiesWhen(args.status === "sent", () => ({ sentAt: existing?.sentAt ?? now })),
      summaryProjectedEventId: args.eventId,
      summaryProjectedStatus: args.status,
    };
    await applyDeliverySummaryProjection(ctx, existing, args, now);
    if (existing) {
      await ctx.db.patch("notificationEmailDeliveries", existing._id, patch);
      return existing._id;
    }

    return await ctx.db.insert("notificationEmailDeliveries", {
      ...patch,
      createdAt: now,
      idempotencyKey: args.idempotencyKey,
    });
  },
  returns: v.id("notificationEmailDeliveries"),
});

export const retryDeliveryOutcome = internalAction({
  args: {
    attempts: v.number(),
    eventId: v.string(),
    failureCode: v.optional(v.string()),
    idempotencyKey: v.string(),
    providerStatus: v.optional(v.number()),
    recipientHash: v.string(),
    status: deliveryStatus,
    writeAttempt: v.number(),
  },
  handler: async (ctx, args) => {
    const { writeAttempt, ...ledgerArgs } = args;
    try {
      await ctx.runMutation(internal.crm.notificationEmailLedger.recordDeliveryOutcome, ledgerArgs);
    } catch {
      if (writeAttempt < MAX_LEDGER_WRITE_ATTEMPTS) {
        await ctx.scheduler.runAfter(
          2 ** writeAttempt * 1000,
          internal.crm.notificationEmailLedger.retryDeliveryOutcome,
          { ...ledgerArgs, writeAttempt: writeAttempt + 1 }
        );
      } else {
        console.error(
          JSON.stringify({
            event: "crm_notification_email_ledger_retry_exhausted",
            eventId: args.eventId,
            recipientHash: args.recipientHash,
          })
        );
      }
    }
    return null;
  },
  returns: v.null(),
});

export const startDeliverySummaryReconciliation = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await loadDeliverySummaryReadiness(ctx);
    const now = Date.now();
    const active = Boolean(
      existing?.status === "running" &&
        existing.version === DELIVERY_SUMMARY_VERSION &&
        now - existing.updatedAt < DELIVERY_SUMMARY_RECONCILIATION_STALE_MS
    );
    if (active || (existing?.ready && existing.version === DELIVERY_SUMMARY_VERSION)) {
      return { generation: existing?.generation ?? 0, scheduled: false };
    }
    const generation = (existing?.generation ?? 0) + 1;
    const readiness = {
      failureCode: undefined,
      generation,
      key: DELIVERY_SUMMARY_READINESS_KEY,
      ready: false,
      residuals: 0,
      scanned: 0,
      stage: "backfill" as const,
      startedAt: now,
      status: "running" as const,
      updatedAt: now,
      version: DELIVERY_SUMMARY_VERSION,
    };
    if (existing) {
      await ctx.db.patch("notificationEmailSummaryReadiness", existing._id, readiness);
    } else {
      await ctx.db.insert("notificationEmailSummaryReadiness", readiness);
    }
    await scheduleDeliverySummaryPage(ctx, {
      cursor: null,
      generation,
      residuals: 0,
      scanned: 0,
      stage: "backfill",
    });
    return { generation, scheduled: true };
  },
  returns: v.object({ generation: v.number(), scheduled: v.boolean() }),
});

export const reconcileDeliverySummaryPage = internalMutation({
  args: {
    cursor: v.union(v.string(), v.null()),
    generation: v.number(),
    residuals: v.number(),
    scanned: v.number(),
    stage: v.union(v.literal("backfill"), v.literal("verify")),
  },
  handler: async (ctx, args) => {
    const readiness = await loadDeliverySummaryReadiness(ctx);
    if (
      readiness?.generation !== args.generation ||
      readiness.status !== "running" ||
      readiness.version !== DELIVERY_SUMMARY_VERSION
    ) {
      return null;
    }
    const page = await ctx.db
      .query("notificationEmailDeliveries")
      .withIndex("by_updatedAt")
      .paginate({ cursor: args.cursor, numItems: DELIVERY_SUMMARY_PAGE_SIZE });
    const scanned = args.scanned + page.page.length;

    if (args.stage === "backfill") {
      if (page.page.some((row) => !hasValidNotificationSummaryProjectionMarker(row))) {
        await ctx.db.patch("notificationEmailSummaryReadiness", readiness._id, {
          failureCode: "invalid_projection_marker",
          ready: false,
          residuals: args.residuals + 1,
          scanned,
          status: "failed",
          updatedAt: Date.now(),
        });
        return null;
      }
      for (const row of page.page) {
        if (
          row.summaryProjectedEventId === row.eventId &&
          row.summaryProjectedStatus === row.status
        ) {
          continue;
        }
        // Rows sharing one event must update its aggregate in order so a page
        // cannot race several read-modify-write transitions against itself.
        // biome-ignore lint/performance/noAwaitInLoops: sequential projection is transactional
        await applyDeliverySummaryProjection(ctx, row, row, row.updatedAt);
        await ctx.db.patch("notificationEmailDeliveries", row._id, {
          summaryProjectedEventId: row.eventId,
          summaryProjectedStatus: row.status,
        });
      }
    }

    const residuals =
      args.stage === "verify"
        ? args.residuals +
          page.page.filter(
            (row) =>
              row.summaryProjectedEventId !== row.eventId ||
              row.summaryProjectedStatus !== row.status
          ).length
        : args.residuals;
    const now = Date.now();
    await ctx.db.patch("notificationEmailSummaryReadiness", readiness._id, {
      residuals,
      scanned,
      stage: args.stage,
      updatedAt: now,
    });

    if (!page.isDone) {
      await scheduleDeliverySummaryPage(ctx, {
        cursor: page.continueCursor,
        generation: args.generation,
        residuals,
        scanned,
        stage: args.stage,
      });
      return null;
    }
    if (args.stage === "backfill") {
      await ctx.db.patch("notificationEmailSummaryReadiness", readiness._id, {
        residuals: 0,
        scanned: 0,
        stage: "verify",
        updatedAt: now,
      });
      await scheduleDeliverySummaryPage(ctx, {
        cursor: null,
        generation: args.generation,
        residuals: 0,
        scanned: 0,
        stage: "verify",
      });
      return null;
    }
    await ctx.db.patch("notificationEmailSummaryReadiness", readiness._id, {
      ...propertiesWhen(residuals > 0, () => ({ failureCode: "projection_residuals" })),
      ready: residuals === 0,
      residuals,
      stage: "complete",
      status: residuals === 0 ? "complete" : "failed",
      updatedAt: now,
    });
    return null;
  },
  returns: v.null(),
});

const summaryValidator = v.object({
  eventId: v.string(),
  exhausted: v.number(),
  origin: v.optional(v.object({ href: v.string(), label: v.string() })),
  queued: v.number(),
  retrying: v.number(),
  sending: v.number(),
  sent: v.number(),
  skipped: v.number(),
  total: v.number(),
  updatedAt: v.number(),
});

const summaryResultValidator = v.object({
  coverage: v.union(v.literal("complete" as const), v.literal("partial" as const)),
  readinessState: v.union(
    v.literal("pending"),
    v.literal("backfilling"),
    v.literal("verifying"),
    v.literal("ready"),
    v.literal("failed")
  ),
  summaries: v.array(summaryValidator),
});

/**
 * Delivery summaries are intentionally restricted to department heads and
 * directors/admin. They never expose recipient identifiers or provider bodies.
 */
export const listDeliverySummary = query({
  args: {
    eventId: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx);
    if (!canViewNotificationEmailDeliverySummary(access)) {
      throw new ConvexError("FORBIDDEN");
    }
    const limit = Math.min(100, Math.max(1, Math.trunc(args.limit ?? 25)));
    const readiness = await ctx.db
      .query("notificationEmailSummaryReadiness")
      .withIndex("by_key", (q) => q.eq("key", DELIVERY_SUMMARY_READINESS_KEY))
      .unique();
    const complete = Boolean(
      readiness?.ready &&
        readiness.status === "complete" &&
        readiness.version === DELIVERY_SUMMARY_VERSION
    );
    let readinessState: "pending" | "backfilling" | "verifying" | "ready" | "failed" = "pending";
    if (complete) {
      readinessState = "ready";
    } else if (readiness?.status === "failed") {
      readinessState = "failed";
    } else if (readiness?.status === "running" && readiness.stage === "verify") {
      readinessState = "verifying";
    } else if (readiness?.status === "running") {
      readinessState = "backfilling";
    }

    const { eventId } = args;
    const candidates = eventId
      ? await ctx.db
          .query("notificationEmailEventSummaries")
          .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
          .take(1)
      : await ctx.db
          .query("notificationEmailEventSummaries")
          .withIndex("by_updatedAt")
          .order("desc")
          .take(Math.min(100, limit * 4));
    const authorizedCandidates = await Promise.all(
      candidates.map(async (summary) => {
        if (summary.total <= 0) {
          return null;
        }
        const notificationId = ctx.db.normalizeId("notifications", summary.eventId);
        const notification = notificationId
          ? await ctx.db.get("notifications", notificationId)
          : null;
        if (!(notification && canReceiveNotification(notification, access))) {
          return null;
        }
        return {
          eventId: summary.eventId,
          exhausted: summary.exhausted,
          origin: {
            href: getNotificationHref({
              entityId: notification.entityId,
              entityType: notification.entityType,
              title: notification.title,
            }),
            label: notification.title,
          },
          queued: summary.queued,
          retrying: summary.retrying,
          sending: summary.sending,
          sent: summary.sent,
          skipped: summary.skipped,
          total: summary.total,
          updatedAt: summary.updatedAt,
        };
      })
    );
    const summaries = authorizedCandidates
      .filter((summary): summary is NonNullable<typeof summary> => summary !== null)
      .slice(0, limit);
    return {
      coverage: complete ? ("complete" as const) : ("partial" as const),
      readinessState,
      summaries,
    };
  },
  returns: summaryResultValidator,
});
