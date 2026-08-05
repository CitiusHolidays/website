import { ConvexError, v } from "convex/values";
import { internalMutation, query } from "../_generated/server";
import { requireHeadOrAdmin } from "./lib/staffAccess";

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

type DeliveryStatus = (typeof NOTIFICATION_EMAIL_DELIVERY_STATUSES)[number];

const TERMINAL_STATUSES = new Set<DeliveryStatus>(["sent", "skipped", "exhausted"]);
const RECIPIENT_HASH_PATTERN = /^[a-z0-9-]{8,128}$/i;

/**
 * Keep error data useful for operators without persisting provider response
 * bodies, addresses, subjects, or other message content.
 */
export function normalizeNotificationEmailFailure(error: unknown) {
  if (!error || typeof error !== "object") {
    return { code: "unknown", providerStatus: undefined };
  }
  const candidate = error as { name?: unknown; statusCode?: unknown };
  const statusCode =
    typeof candidate.statusCode === "number" && Number.isFinite(candidate.statusCode)
      ? Math.trunc(candidate.statusCode)
      : undefined;
  const name = typeof candidate.name === "string" ? candidate.name.toLowerCase() : "";
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
  if (
    existing.status === "exhausted" &&
    incoming.status !== "sent" &&
    incoming.attempts < existing.attempts
  ) {
    return false;
  }
  return incoming.attempts >= existing.attempts || !TERMINAL_STATUSES.has(existing.status);
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
      ...(args.status === "sent" ? { sentAt: existing?.sentAt ?? now } : {}),
    };
    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }

    return await ctx.db.insert("notificationEmailDeliveries", {
      ...patch,
      createdAt: now,
      idempotencyKey: args.idempotencyKey,
    });
  },
});

const summaryValidator = v.object({
  eventId: v.string(),
  exhausted: v.number(),
  failedRecipientHashes: v.array(v.string()),
  queued: v.number(),
  retrying: v.number(),
  sending: v.number(),
  sent: v.number(),
  skipped: v.number(),
  total: v.number(),
  updatedAt: v.number(),
});

/**
 * Failure summaries are intentionally restricted to leadership/admin access.
 * Recipient hashes distinguish failures without disclosing staff addresses.
 */
export const listDeliverySummary = query({
  args: {
    eventId: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireHeadOrAdmin(ctx, ["Sales Head", "HR"]);
    const limit = Math.min(100, Math.max(1, Math.trunc(args.limit ?? 25)));
    const { eventId } = args;
    const rows = eventId
      ? await ctx.db
          .query("notificationEmailDeliveries")
          .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
          .take(500)
      : await ctx.db
          .query("notificationEmailDeliveries")
          .withIndex("by_updatedAt")
          .order("desc")
          .take(500);
    const groups = new Map<string, (typeof rows)[number][]>();
    for (const row of rows) {
      const group = groups.get(row.eventId) ?? [];
      group.push(row);
      groups.set(row.eventId, group);
    }
    return Array.from(groups.values())
      .sort(
        (left, right) =>
          Math.max(...right.map((row) => row.updatedAt)) -
          Math.max(...left.map((row) => row.updatedAt))
      )
      .slice(0, limit)
      .map((group) => {
        const counts = Object.fromEntries(
          NOTIFICATION_EMAIL_DELIVERY_STATUSES.map((status) => [
            status,
            group.filter((row) => row.status === status).length,
          ])
        ) as Record<DeliveryStatus, number>;
        return {
          eventId: group[0]?.eventId ?? "",
          exhausted: counts.exhausted,
          failedRecipientHashes: group
            .filter((row) => row.status === "exhausted" || row.status === "retrying")
            .map((row) => row.recipientHash),
          queued: counts.queued,
          retrying: counts.retrying,
          sending: counts.sending,
          sent: counts.sent,
          skipped: counts.skipped,
          total: group.length,
          updatedAt: Math.max(...group.map((row) => row.updatedAt)),
        };
      });
  },
  returns: v.array(summaryValidator),
});
