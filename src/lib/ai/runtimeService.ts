import { createHmac, randomBytes } from "node:crypto";
import { fetchMutation } from "convex/nextjs";
import { anyApi } from "convex/server";
import { Effect } from "effect";
import { buildExternalIoEffect } from "@/lib/effectAdoption";
import type { AiFeature } from "./runtimePolicy";

const RATE_LIMITS = {
  concierge: { limit: 20, windowMs: 10 * 60 * 1000 },
  journeyPlanner: { limit: 12, windowMs: 10 * 60 * 1000 },
} as const;

interface RuntimeEnvironment {
  AI_RATE_LIMIT_SALT?: string;
  AI_RUNTIME_SECRET?: string;
  NEXT_PUBLIC_CONVEX_URL?: string;
  NODE_ENV?: string;
}

type FetchMutationImplementation = (
  mutation: unknown,
  args: Record<string, unknown>,
  options?: { url?: string }
) => Promise<any>;

interface RuntimeDependencies {
  env?: RuntimeEnvironment;
  fetchMutationImpl?: FetchMutationImplementation;
  logger?: Pick<Console, "error">;
  now?: () => number;
}

export interface AiRateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

interface DevelopmentRateLimitBucket {
  count: number;
  resetAt: number;
}

const developmentRateLimitSalt = randomBytes(32).toString("hex");
const developmentRateLimitBuckets = new Map<string, DevelopmentRateLimitBucket>();

function consumeDevelopmentRateLimit({
  feature,
  rawKey,
  now,
}: {
  feature: AiFeature;
  now: number;
  rawKey: string;
}): AiRateLimitResult {
  const policy = RATE_LIMITS[feature];
  const keyHash = createHmac("sha256", developmentRateLimitSalt)
    .update(`${feature}\0${rawKey}`)
    .digest("hex");
  const existing = developmentRateLimitBuckets.get(keyHash);

  if (!existing || now >= existing.resetAt) {
    developmentRateLimitBuckets.set(keyHash, { count: 1, resetAt: now + policy.windowMs });
    return { allowed: true, remaining: policy.limit - 1, retryAfterSec: 0 };
  }
  if (existing.count >= policy.limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return { allowed: true, remaining: policy.limit - existing.count, retryAfterSec: 0 };
}

export interface AiTelemetryEvent {
  fallback: boolean;
  feature: AiFeature;
  finishReason?: string;
  inputTokens?: number;
  latencyMs: number;
  model: string;
  outputTokens?: number;
  terminalState: "completed" | "failed" | "interrupted";
}

function runtimeConfiguration(env: RuntimeEnvironment) {
  const secret = env.AI_RUNTIME_SECRET;
  const url = env.NEXT_PUBLIC_CONVEX_URL;
  if (!(secret && url)) {
    throw new Error("AI shared runtime storage is not configured");
  }
  return { secret, url };
}

export function hashAiRateLimitKey(
  feature: AiFeature,
  rawKey: string,
  env: RuntimeEnvironment = process.env as RuntimeEnvironment
): string {
  const salt = env.AI_RATE_LIMIT_SALT;
  if (!salt) {
    throw new Error("AI_RATE_LIMIT_SALT is not configured");
  }
  return createHmac("sha256", salt).update(`${feature}\0${rawKey}`).digest("hex");
}

export async function consumeSharedAiRateLimit(
  { feature, rawKey }: { feature: AiFeature; rawKey: string },
  dependencies: RuntimeDependencies = {}
): Promise<AiRateLimitResult> {
  const env = dependencies.env ?? (process.env as RuntimeEnvironment);
  const fetchMutationImpl = dependencies.fetchMutationImpl ?? fetchMutation;
  let configuration: ReturnType<typeof runtimeConfiguration>;
  try {
    configuration = runtimeConfiguration(env);
  } catch (error) {
    if (env.NODE_ENV === "production") {
      throw error;
    }
    return consumeDevelopmentRateLimit({
      feature,
      now: dependencies.now?.() ?? Date.now(),
      rawKey,
    });
  }
  const { secret, url } = configuration;
  const keyHash = hashAiRateLimitKey(feature, rawKey, env);
  const policy = RATE_LIMITS[feature];

  return await Effect.runPromise(
    buildExternalIoEffect(
      "consume shared AI rate limit",
      async () =>
        await fetchMutationImpl(
          anyApi.aiRuntime.consumeRateLimit,
          {
            feature,
            keyHash,
            limit: policy.limit,
            secret,
            windowMs: policy.windowMs,
          },
          { url }
        )
    )
  );
}

export async function recordAiTelemetry(
  event: AiTelemetryEvent,
  dependencies: RuntimeDependencies = {}
): Promise<boolean> {
  const env = dependencies.env ?? (process.env as RuntimeEnvironment);
  const fetchMutationImpl = dependencies.fetchMutationImpl ?? fetchMutation;
  const logger = dependencies.logger ?? console;

  try {
    const { secret, url } = runtimeConfiguration(env);
    await Effect.runPromise(
      buildExternalIoEffect(
        "record AI telemetry",
        async () =>
          await fetchMutationImpl(anyApi.aiRuntime.recordTelemetry, { ...event, secret }, { url })
      )
    );
    return true;
  } catch (error) {
    logger.error("AI telemetry write failed", error);
    return false;
  }
}
