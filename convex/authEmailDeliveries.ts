import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";
import { requireOperationalAdmin } from "./crm/lib/operationalAdminAccess";
import { operationalTargetIdentity } from "./crm/lib/operationalTargetIdentity";
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
const AUTH_EMAIL_HEALTH_WINDOW_MS = 24 * 60 * 60 * 1000;
const AUTH_EMAIL_HEALTH_LIMIT = 50;
const SAFE_FAILURE_CODES = new Set([
  "network_error",
  "operator_suppressed",
  "provider_error",
  "provider_not_configured",
  "provider_rejected",
  "provider_unavailable",
  "rate_limited",
  "token_expired",
]);

const statusCountsValidator = v.object({
  exhausted: v.number(),
  queued: v.number(),
  retrying: v.number(),
  sending: v.number(),
  sent: v.number(),
  skipped: v.number(),
});

function emptyStatusCounts() {
  return {
    exhausted: 0,
    queued: 0,
    retrying: 0,
    sending: 0,
    sent: 0,
    skipped: 0,
  } satisfies Record<AuthEmailDeliveryStatus, number>;
}

export function safeAuthEmailFailureCode(failureCode?: string) {
  return failureCode && SAFE_FAILURE_CODES.has(failureCode) ? failureCode : undefined;
}

function providerStatusClass(providerStatus?: number) {
  if (providerStatus === 429) {
    return "rate_limited" as const;
  }
  if (providerStatus !== undefined && providerStatus >= 500) {
    return "server_error" as const;
  }
  if (providerStatus !== undefined && providerStatus >= 400) {
    return "client_error" as const;
  }
}

export function authEmailRecoveryAction(
  outcome: {
    expiresAt: number;
    failureCode?: string;
    purpose: AuthEmailPurpose;
    status: AuthEmailDeliveryStatus;
  },
  at: number
) {
  if (outcome.status === "sent") {
    return "No recovery action is needed.";
  }
  if (["queued", "sending", "retrying"].includes(outcome.status)) {
    return "Wait for the bounded delivery attempt to finish before taking another action.";
  }
  if (outcome.expiresAt <= at || outcome.failureCode === "token_expired") {
    return outcome.purpose === "verification"
      ? "Ask the user to request a fresh verification link; never resend the expired token."
      : "Ask the user to request a fresh password-reset link; never resend the expired token.";
  }
  if (outcome.failureCode === "operator_suppressed") {
    return "Review the matching authentication email control before asking for a fresh link.";
  }
  if (outcome.failureCode === "provider_not_configured") {
    return "Configure Resend for this exact target, then ask the user to request a fresh link.";
  }
  if (outcome.failureCode === "provider_rejected") {
    return "Review the account email through its owning auth workflow, then request a fresh link.";
  }
  return "Review Resend and runtime health for this target, then request a fresh link.";
}

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

function authEmailEffectState(status: AuthEmailDeliveryStatus) {
  if (status === "sent") {
    return "sent" as const;
  }
  if (status === "skipped") {
    return "not_attempted" as const;
  }
  if (status === "exhausted") {
    return "failed" as const;
  }
  return "in_progress" as const;
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

const authEmailHealthRowValidator = v.object({
  attempts: v.number(),
  effect: v.union(
    v.literal("failed"),
    v.literal("in_progress"),
    v.literal("not_attempted"),
    v.literal("sent")
  ),
  expiresAt: v.number(),
  failureCode: v.optional(v.string()),
  intent: v.literal("recorded"),
  providerStatusClass: v.optional(
    v.union(v.literal("client_error"), v.literal("rate_limited"), v.literal("server_error"))
  ),
  purpose: purposeValidator,
  recoveryAction: v.string(),
  sentAt: v.optional(v.number()),
  status: statusValidator,
  updatedAt: v.number(),
  windowPosition: v.number(),
});

/**
 * Exact-Admin health projection over the existing privacy-safe receipt owner.
 * Correlation and recipient digests never cross this boundary.
 */
export const getDeliveryHealth = query({
  args: { at: v.number() },
  handler: async (ctx, args) => {
    await requireOperationalAdmin(ctx);
    if (!Number.isSafeInteger(args.at) || args.at <= 0) {
      throw new ConvexError("AUTH_EMAIL_HEALTH_TIME_INVALID");
    }
    const target = operationalTargetIdentity();
    const startedAt = Math.max(0, args.at - AUTH_EMAIL_HEALTH_WINDOW_MS);
    const rows = await ctx.db
      .query("authEmailDeliveries")
      .withIndex("by_updatedAt", (index) =>
        index.gte("updatedAt", startedAt).lte("updatedAt", args.at)
      )
      .order("desc")
      .take(AUTH_EMAIL_HEALTH_LIMIT + 1);
    const bounded = rows.slice(0, AUTH_EMAIL_HEALTH_LIMIT);
    const counts = {
      password_reset: emptyStatusCounts(),
      verification: emptyStatusCounts(),
    };
    for (const row of bounded) {
      counts[row.purpose][row.status] += 1;
    }
    return {
      counts,
      coverage:
        rows.length > AUTH_EMAIL_HEALTH_LIMIT ? ("partial" as const) : ("complete" as const),
      effectsObserved: bounded.filter((row) => row.status !== "queued").length,
      intentsObserved: bounded.length,
      recent: bounded.map((row, index) => {
        const failureCode = safeAuthEmailFailureCode(row.failureCode);
        const statusClass = providerStatusClass(row.providerStatus);
        return {
          attempts: row.attempts,
          effect: authEmailEffectState(row.status),
          expiresAt: row.expiresAt,
          ...propertiesWhen(failureCode, () => ({ failureCode })),
          intent: "recorded" as const,
          ...propertiesWhen(statusClass, () => ({ providerStatusClass: statusClass })),
          purpose: row.purpose,
          recoveryAction: authEmailRecoveryAction(
            { expiresAt: row.expiresAt, failureCode, purpose: row.purpose, status: row.status },
            args.at
          ),
          ...propertiesWhen(row.sentAt, () => ({ sentAt: row.sentAt })),
          status: row.status,
          updatedAt: row.updatedAt,
          windowPosition: index + 1,
        };
      }),
      target,
      window: { endedAt: args.at, startedAt },
    };
  },
  returns: v.object({
    counts: v.object({
      password_reset: statusCountsValidator,
      verification: statusCountsValidator,
    }),
    coverage: v.union(v.literal("complete"), v.literal("partial")),
    effectsObserved: v.number(),
    intentsObserved: v.number(),
    recent: v.array(authEmailHealthRowValidator),
    target: v.object({
      targetDeployment: v.string(),
      targetEnvironment: v.string(),
      targetRevision: v.string(),
    }),
    window: v.object({ endedAt: v.number(), startedAt: v.number() }),
  }),
});
