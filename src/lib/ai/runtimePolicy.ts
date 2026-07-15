export const AI_ROUTE_BUDGET_MS = 60_000;

export const AI_MODEL_SELECTION_EVIDENCE = {
  catalogCheckedAt: "2026-07-14T08:31:00Z",
  measuredAt: "2026-07-14T08:24:21Z",
  privacyDecision:
    "Only OpenRouter free model identifiers are enabled; no paid inference or application-side prompt retention was introduced. Free endpoints use the workspace OpenRouter account data policy, so both public UIs tell users not to submit sensitive personal, passport, or payment data.",
  samples: [
    {
      feature: "concierge",
      finishReason: "stop",
      model: "google/gemma-4-31b-it:free",
      toolCallObserved: true,
      totalDurationMs: 2593,
    },
    {
      feature: "concierge",
      finishReason: "tool_calls",
      model: "nvidia/nemotron-3-super-120b-a12b:free",
      timeToFirstPartMs: 6766,
      toolCallObserved: true,
      totalDurationMs: 6828,
    },
    {
      feature: "concierge",
      finishReason: "tool_calls",
      model: "nvidia/nemotron-3-ultra-550b-a55b:free",
      timeToFirstPartMs: 10_739,
      toolCallObserved: true,
      totalDurationMs: 10_740,
    },
    {
      feature: "journeyPlanner",
      finishReason: "length",
      model: "nvidia/nemotron-3-ultra-550b-a55b:free",
      timeToFirstPartMs: 1283,
      toolCallObserved: false,
      totalDurationMs: 3727,
    },
    {
      feature: "journeyPlanner",
      finishReason: "length",
      model: "nvidia/nemotron-3-super-120b-a12b:free",
      timeToFirstPartMs: 1892,
      toolCallObserved: false,
      totalDurationMs: 5026,
    },
  ],
  selectionDecision:
    "Gemma 4 31B is the responsive tool-capable primary; Nemotron 3 Super is the efficient long-context fallback; Nemotron 3 Ultra is reserved as the slower, stronger agentic fallback.",
  source: "OpenRouter live streaming probes with fixed, non-sensitive representative prompts",
} as const;

export type AiFeature = "concierge" | "journeyPlanner";

export interface AiRuntimePolicy {
  chunkTimeoutMs: number;
  maxOutputTokens: number;
  maxRetries: 0;
  maxSteps: number;
  minimumAttemptMs: number;
  models: readonly string[];
  providerAttemptTimeoutMs: number;
  routeHeadroomMs: number;
  totalTimeoutMs: number;
}

const COMMON_POLICY = {
  chunkTimeoutMs: 12_000,
  maxRetries: 0,
  minimumAttemptMs: 3000,
  providerAttemptTimeoutMs: 18_000,
  routeHeadroomMs: 15_000,
  totalTimeoutMs: 45_000,
} as const;

export const AI_RUNTIME_POLICIES = {
  concierge: {
    ...COMMON_POLICY,
    maxOutputTokens: 800,
    maxSteps: 4,
    models: [
      "google/gemma-4-31b-it:free",
      "nvidia/nemotron-3-super-120b-a12b:free",
      "nvidia/nemotron-3-ultra-550b-a55b:free",
    ],
  },
  journeyPlanner: {
    ...COMMON_POLICY,
    maxOutputTokens: 900,
    maxSteps: 1,
    models: [
      "nvidia/nemotron-3-ultra-550b-a55b:free",
      "nvidia/nemotron-3-super-120b-a12b:free",
      "google/gemma-4-31b-it:free",
    ],
  },
} as const satisfies Record<AiFeature, AiRuntimePolicy>;

export function assertRuntimePolicy(policy: AiRuntimePolicy): void {
  if (policy.models.length < 2) {
    throw new Error("AI runtime policy requires a task-compatible fallback");
  }
  if (!policy.models.every((model) => model.endsWith(":free"))) {
    throw new Error("Paid AI inference requires an explicit reviewed policy change");
  }
  if (new Set(policy.models).size !== policy.models.length) {
    throw new Error("AI runtime policy contains duplicate models");
  }
  if (policy.maxRetries !== 0) {
    throw new Error("Provider retries must not multiply the explicit fallback budget");
  }
  if (policy.totalTimeoutMs + policy.routeHeadroomMs > AI_ROUTE_BUDGET_MS) {
    throw new Error("AI runtime policy exceeds the route execution budget");
  }
  if (policy.providerAttemptTimeoutMs >= policy.totalTimeoutMs) {
    throw new Error("AI runtime policy leaves no time for fallback");
  }
}

for (const policy of Object.values(AI_RUNTIME_POLICIES)) {
  assertRuntimePolicy(policy);
}

export interface ProviderAttempt {
  attempt: number;
  fallback: boolean;
  model: string;
  remainingMs: number;
  timeoutMs: number;
}

interface ProviderAttemptResult<Value> {
  value: Value;
}

interface ProviderFallbackOptions<Value> {
  minimumAttemptMs?: number;
  models: readonly string[];
  now?: () => number;
  providerAttemptTimeoutMs?: number;
  runAttempt: (attempt: ProviderAttempt) => Promise<ProviderAttemptResult<Value>>;
  totalTimeoutMs: number;
}

export interface ProviderFallbackResult<Value> {
  attempts: number;
  fallback: boolean;
  model: string;
  value: Value;
}

export async function runProviderFallback<Value>({
  minimumAttemptMs = 1,
  models,
  now = Date.now,
  providerAttemptTimeoutMs = Number.POSITIVE_INFINITY,
  runAttempt,
  totalTimeoutMs,
}: ProviderFallbackOptions<Value>): Promise<ProviderFallbackResult<Value>> {
  const startedAt = now();
  let attempts = 0;
  let lastError: unknown;

  for (const [index, model] of models.entries()) {
    const remainingMs = totalTimeoutMs - (now() - startedAt);
    if (remainingMs < minimumAttemptMs) {
      throw new Error("AI route budget exhausted", { cause: lastError });
    }

    attempts += 1;
    try {
      const result = await runAttempt({
        attempt: attempts,
        fallback: index > 0,
        model,
        remainingMs,
        timeoutMs: Math.min(providerAttemptTimeoutMs, remainingMs),
      });
      return {
        attempts,
        fallback: index > 0,
        model,
        value: result.value,
      };
    } catch (error) {
      lastError = error;
    }
  }

  if (totalTimeoutMs - (now() - startedAt) < minimumAttemptMs) {
    throw new Error("AI route budget exhausted", { cause: lastError });
  }
  throw new Error("All AI providers failed", { cause: lastError });
}
