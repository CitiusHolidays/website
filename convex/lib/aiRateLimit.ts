import { RateLimiter } from "@convex-dev/rate-limiter";
import type { MutationCtx } from "../_generated/server";
import { rateLimiterComponent } from "./rateLimiterComponent";

const rateLimiter = new RateLimiter(rateLimiterComponent);

interface AiRateLimitArgs {
  feature: "concierge" | "journeyPlanner";
  keyHash: string;
  limit: number;
  windowMs: number;
}

export interface AiRateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

function componentLimitName(args: AiRateLimitArgs) {
  return `ai:${args.feature}:${args.limit}:${args.windowMs}`;
}

export async function consumeComponentAiRateLimit(
  ctx: MutationCtx,
  args: AiRateLimitArgs,
  now: number
): Promise<AiRateLimitResult> {
  const name = componentLimitName(args);
  const config = {
    capacity: args.limit,
    kind: "fixed window" as const,
    period: args.windowMs,
    rate: args.limit,
    start: now,
  };
  const status = await rateLimiter.limit(ctx, name, {
    config,
    key: args.keyHash,
  });
  if (!status.ok) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil(status.retryAfter / 1000)),
    };
  }
  const value = await rateLimiter.getValue(ctx, name, {
    config,
    key: args.keyHash,
  });
  return {
    allowed: true,
    remaining: Math.max(0, Math.floor(value.value)),
    retryAfterSec: 0,
  };
}
