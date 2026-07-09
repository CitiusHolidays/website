import { Effect } from "effect";

/**
 * Effect adoption audit for this migration tranche:
 * - src/app/api/create-order/route.ts: external-io, typed-recoverable-errors.
 * - src/lib/paymentVerification.ts: external-io, typed-recoverable-errors.
 * - src/lib/razorpayWebhook.ts: external-io, typed-recoverable-errors.
 * - convex/crm/notificationEmailDelivery.ts: external-io, retry-or-throttle,
 *   typed-recoverable-errors, test-time-dependency-substitution.
 * - src/lib/portal/spreadsheetImports.ts: no Effect; keep plain TypeScript until
 *   retry/throttle, rollback, or dependency-substitution pressures are present.
 */
export const EFFECT_ADOPTION_PRESSURES = [
  "external-io",
  "retry-or-throttle",
  "concurrency-control",
  "typed-recoverable-errors",
  "rollback-or-cleanup",
  "test-time-dependency-substitution",
] as const;

export type EffectAdoptionPressure = (typeof EFFECT_ADOPTION_PRESSURES)[number];

export interface EffectAdoptionEvaluation {
  appropriate: boolean;
  matchedPressures: EffectAdoptionPressure[];
  missingPressureCount: number;
}

export class ExternalIoFailure {
  readonly _tag = "ExternalIoFailure";
  readonly cause: unknown;
  readonly operation: string;

  constructor(operation: string, cause: unknown) {
    this.operation = operation;
    this.cause = cause;
  }

  toString() {
    const message = this.cause instanceof Error ? this.cause.message : String(this.cause);
    return `${this.operation} failed: ${message}`;
  }
}

const pressureSet = new Set<EffectAdoptionPressure>(EFFECT_ADOPTION_PRESSURES);

export function evaluateEffectAdoption(
  pressures: Iterable<EffectAdoptionPressure>
): EffectAdoptionEvaluation {
  const matchedPressures = Array.from(
    new Set(Array.from(pressures).filter((pressure) => pressureSet.has(pressure)))
  );

  return {
    appropriate: matchedPressures.length >= 2,
    matchedPressures,
    missingPressureCount: Math.max(0, 2 - matchedPressures.length),
  };
}

export function buildExternalIoEffect<Result>(
  operation: string,
  run: () => Promise<Result>
): Effect.Effect<Result, ExternalIoFailure> {
  return Effect.tryPromise({
    catch: (cause) => new ExternalIoFailure(operation, cause),
    try: run,
  });
}
