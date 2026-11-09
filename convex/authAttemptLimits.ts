import { RateLimiter } from "@convex-dev/rate-limiter";
import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import {
  AUTH_ATTEMPT_ALARM_PERIOD_MS,
  AUTH_EMAILS_OVERALL_PER_HOUR,
  AUTH_EMAILS_PER_ADDRESS,
  AUTH_EMAILS_PERIOD_MS,
  PASSWORD_SIGN_IN_OVERALL_PER_HOUR,
  PASSWORD_SIGN_IN_PER_ADDRESS,
  PASSWORD_SIGN_IN_PERIOD_MS,
} from "./lib/authAttemptLimits";
import { rateLimiterComponent } from "./lib/rateLimiterComponent";

const HOUR_MS = 60 * 60 * 1000;
// The overall buckets take a write on every attempt, so they are split across shards to keep
// concurrent sign-ins from contending for one document.
const CEILING_SHARDS = 10;

const limiter = new RateLimiter(rateLimiterComponent, {
  authEmailCeilingAlarm: { kind: "fixed window", period: AUTH_ATTEMPT_ALARM_PERIOD_MS, rate: 1 },
  authEmailOverall: {
    kind: "fixed window",
    period: HOUR_MS,
    rate: AUTH_EMAILS_OVERALL_PER_HOUR,
    shards: CEILING_SHARDS,
  },
  authEmailPerAddress: {
    capacity: AUTH_EMAILS_PER_ADDRESS,
    kind: "token bucket",
    period: AUTH_EMAILS_PERIOD_MS,
    rate: AUTH_EMAILS_PER_ADDRESS,
  },
  passwordSignInCeilingAlarm: {
    kind: "fixed window",
    period: AUTH_ATTEMPT_ALARM_PERIOD_MS,
    rate: 1,
  },
  passwordSignInOverall: {
    kind: "fixed window",
    period: HOUR_MS,
    rate: PASSWORD_SIGN_IN_OVERALL_PER_HOUR,
    shards: CEILING_SHARDS,
  },
  passwordSignInPerAddress: {
    capacity: PASSWORD_SIGN_IN_PER_ADDRESS,
    kind: "token bucket",
    period: PASSWORD_SIGN_IN_PERIOD_MS,
    rate: PASSWORD_SIGN_IN_PER_ADDRESS,
  },
});

const LIMITS = {
  auth_email: {
    alarm: "authEmailCeilingAlarm",
    overall: "authEmailOverall",
    perAddress: "authEmailPerAddress",
  },
  password_sign_in: {
    alarm: "passwordSignInCeilingAlarm",
    overall: "passwordSignInOverall",
    perAddress: "passwordSignInPerAddress",
  },
} as const;

const KEY_DIGEST_PATTERN = /^[0-9a-f]{64}$/;

/**
 * Counts one sign-in attempt or auth email against its address (a digest of the folded address,
 * see `lib/authAttemptLimits`) and against the overall ceiling. Only the per-address limit
 * refuses; passing the ceiling logs an alarm and the attempt goes ahead.
 */
export const consumeAuthAttempt = internalMutation({
  args: {
    keyDigest: v.string(),
    kind: v.union(v.literal("auth_email"), v.literal("password_sign_in")),
  },
  handler: async (ctx, args) => {
    if (!KEY_DIGEST_PATTERN.test(args.keyDigest)) {
      throw new Error("Invalid auth attempt key");
    }
    const names = LIMITS[args.kind];
    const overall = await limiter.limit(ctx, names.overall);
    if (!overall.ok) {
      // An alarm, not a lockout: far more attempts than real people make.
      const alarm = await limiter.limit(ctx, names.alarm);
      if (alarm.ok) {
        console.warn(JSON.stringify({ event: "auth.attempt_overall_ceiling", kind: args.kind }));
      }
    }
    const perAddress = await limiter.limit(ctx, names.perAddress, { key: args.keyDigest });
    return perAddress.ok
      ? { ok: true as const }
      : {
          ok: false as const,
          retryAfterSeconds: Math.max(1, Math.ceil(perAddress.retryAfter / 1000)),
        };
  },
  returns: v.union(
    v.object({ ok: v.literal(true) }),
    v.object({ ok: v.literal(false), retryAfterSeconds: v.number() })
  ),
});
