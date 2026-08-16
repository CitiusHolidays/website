import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { propertiesWhen } from "./lib/runtimeValues";

export const AUTH_EMAIL_PURPOSES = ["password_reset", "verification"] as const;
export const AUTH_EMAIL_DELIVERY_STATUSES = [
  "queued",
  "sending",
  "retrying",
  "sent",
  "skipped",
  "exhausted",
] as const;

type AuthEmailPurpose = (typeof AUTH_EMAIL_PURPOSES)[number];
type AuthEmailDeliveryStatus = (typeof AUTH_EMAIL_DELIVERY_STATUSES)[number];

const purposeValidator = v.union(v.literal("password_reset"), v.literal("verification"));
const statusValidator = v.union(
  v.literal("queued"),
  v.literal("sending"),
  v.literal("retrying"),
  v.literal("sent"),
  v.literal("skipped"),
  v.literal("exhausted")
);
const correlationDigestPattern = /^[0-9a-f]{64}$/;
const STATUS_RANK = {
  exhausted: 3,
  queued: 0,
  retrying: 2,
  sending: 1,
  sent: 4,
  skipped: 3,
} satisfies Record<AuthEmailDeliveryStatus, number>;

const outcomeValidator = v.object({
  attempts: v.number(),
  correlationDigest: v.string(),
  expiresAt: v.number(),
  failureCode: v.optional(v.string()),
  providerStatus: v.optional(v.number()),
  purpose: purposeValidator,
  sentAt: v.optional(v.number()),
  status: statusValidator,
  updatedAt: v.number(),
});

function publicOutcome(row: {
  attempts: number;
  correlationDigest: string;
  expiresAt: number;
  failureCode?: string;
  providerStatus?: number;
  purpose: AuthEmailPurpose;
  sentAt?: number;
  status: AuthEmailDeliveryStatus;
  updatedAt: number;
}) {
  return {
    attempts: row.attempts,
    correlationDigest: row.correlationDigest,
    expiresAt: row.expiresAt,
    failureCode: row.failureCode,
    providerStatus: row.providerStatus,
    purpose: row.purpose,
    sentAt: row.sentAt,
    status: row.status,
    updatedAt: row.updatedAt,
  };
}

function shouldApplyOutcome(
  existing: { attempts: number; status: AuthEmailDeliveryStatus },
  incoming: { attempts: number; status: AuthEmailDeliveryStatus }
) {
  if (existing.status === "sent" && incoming.status !== "sent") {
    return false;
  }
  if (incoming.attempts !== existing.attempts) {
    return incoming.attempts > existing.attempts;
  }
  return STATUS_RANK[incoming.status] >= STATUS_RANK[existing.status];
}

export const recordOutcome = internalMutation({
  args: {
    attempts: v.number(),
    correlationDigest: v.string(),
    expiresAt: v.number(),
    failureCode: v.optional(v.string()),
    providerStatus: v.optional(v.number()),
    purpose: purposeValidator,
    status: statusValidator,
  },
  handler: async (ctx, args) => {
    if (!correlationDigestPattern.test(args.correlationDigest)) {
      throw new ConvexError("AUTH_EMAIL_CORRELATION_INVALID");
    }
    if (!Number.isInteger(args.attempts) || args.attempts < 0 || args.attempts > 10) {
      throw new ConvexError("AUTH_EMAIL_ATTEMPTS_INVALID");
    }
    if (!Number.isSafeInteger(args.expiresAt) || args.expiresAt <= 0) {
      throw new ConvexError("AUTH_EMAIL_EXPIRY_INVALID");
    }
    const existing = await ctx.db
      .query("authEmailDeliveries")
      .withIndex("by_correlationDigest", (q) => q.eq("correlationDigest", args.correlationDigest))
      .unique();
    if (existing && existing.purpose !== args.purpose) {
      throw new ConvexError("AUTH_EMAIL_CORRELATION_MISMATCH");
    }
    if (existing && !shouldApplyOutcome(existing, args)) {
      return publicOutcome(existing);
    }
    const now = Date.now();
    const value = {
      attempts: Math.max(existing?.attempts ?? 0, args.attempts),
      correlationDigest: args.correlationDigest,
      expiresAt: existing?.expiresAt ?? args.expiresAt,
      failureCode: args.failureCode,
      providerStatus: args.providerStatus,
      purpose: args.purpose,
      ...propertiesWhen(args.status === "sent", () => ({ sentAt: existing?.sentAt ?? now })),
      status: args.status,
      updatedAt: now,
    };
    if (existing) {
      await ctx.db.patch("authEmailDeliveries", existing._id, value);
      return publicOutcome({ ...existing, ...value });
    }
    await ctx.db.insert("authEmailDeliveries", { ...value, createdAt: now });
    return publicOutcome(value);
  },
  returns: outcomeValidator,
});

export const getOutcome = internalQuery({
  args: { correlationDigest: v.string() },
  handler: async (ctx, args) => {
    if (!correlationDigestPattern.test(args.correlationDigest)) {
      return null;
    }
    const row = await ctx.db
      .query("authEmailDeliveries")
      .withIndex("by_correlationDigest", (q) => q.eq("correlationDigest", args.correlationDigest))
      .unique();
    return row ? publicOutcome(row) : null;
  },
  returns: v.union(v.null(), outcomeValidator),
});

export const listRecentOutcomes = internalQuery({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = Math.min(100, Math.max(1, Math.trunc(args.limit ?? 25)));
    const rows = await ctx.db
      .query("authEmailDeliveries")
      .withIndex("by_updatedAt")
      .order("desc")
      .take(limit);
    return rows.map(publicOutcome);
  },
  returns: v.array(outcomeValidator),
});
