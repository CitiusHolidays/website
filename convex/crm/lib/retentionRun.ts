import type { FunctionReference, FunctionVisibility } from "convex/server";
import { v } from "convex/values";
import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { assertMigrationSecret } from "../../migrationAuth";
import { type OperationalControlKey, resolveOperationalControl } from "./operationalControls";

/**
 * One retention rule plans a bounded page of decisions; the scheduled job applies them and the
 * dry-run report only counts them. Both run the same plan, so the report shows exactly what the
 * job would do at the same `asOf` time. Outcome names are content-free labels such as
 * `deleted` or `kept_undated`; no record content leaves a report.
 */
export interface RetentionDecision {
  apply?: (ctx: MutationCtx) => Promise<void>;
  outcome: string;
}

export interface RetentionPlan {
  /** Opaque position of the next page, or null when the scan is complete. */
  continueCursor: string | null;
  decisions: RetentionDecision[];
}

export type RetentionCounts = Record<string, number>;

export function tallyRetentionOutcomes(decisions: RetentionDecision[]) {
  const counts: RetentionCounts = {};
  for (const { outcome } of decisions) {
    counts[outcome] = (counts[outcome] ?? 0) + 1;
  }
  return counts;
}

/** Applies one planned page and schedules the next page with the run's fixed `asOf`. */
export async function applyRetentionPlan(
  ctx: MutationCtx,
  plan: RetentionPlan,
  continueWith: (cursor: string) => Promise<void>
) {
  for (const decision of plan.decisions) {
    if (decision.apply) {
      // biome-ignore lint/performance/noAwaitInLoops: decisions on one page may touch the same rows (guardian links, Job Cards), so they apply in order.
      await decision.apply(ctx);
    }
  }
  const scheduledContinuation = plan.continueCursor !== null;
  if (plan.continueCursor !== null) {
    await continueWith(plan.continueCursor);
  }
  return { counts: tallyRetentionOutcomes(plan.decisions), scheduledContinuation };
}

export type RetentionPlanner = (
  ctx: QueryCtx,
  asOf: number,
  cursor: string | null
) => Promise<RetentionPlan>;

type ContinuationRef = FunctionReference<
  "mutation",
  FunctionVisibility,
  { asOf: number; cursor: string },
  unknown
>;

/**
 * One page of a scheduled retention run: plan at the run's fixed `asOf`, apply, and schedule
 * `continueRef` for the next page in a fresh transaction. A continuation (`cursor` set) first
 * re-checks the job's Live Feature Control, so pausing a job also stops a run in progress; the
 * first page is already gated by the scheduled-job action.
 */
export async function runRetentionPage(
  ctx: MutationCtx,
  job: {
    continueRef: ContinuationRef;
    controlKey: OperationalControlKey;
    planner: RetentionPlanner;
  },
  asOf: number,
  cursor: string | null
) {
  if (cursor !== null) {
    const control = await resolveOperationalControl(ctx, job.controlKey, { at: Date.now() });
    if (!control.enabled) {
      return { counts: {}, scheduledContinuation: false };
    }
  }
  return await applyRetentionPlan(ctx, await job.planner(ctx, asOf, cursor), async (next) => {
    await ctx.scheduler.runAfter(0, job.continueRef, { asOf, cursor: next });
  });
}

/**
 * Deletes a storage blob once no record references it any more. Call after the owning row is
 * deleted; the shared reference check runs in its own transaction.
 */
export async function deleteStorageWhenUnreferenced(
  ctx: MutationCtx,
  storageId: Id<"_storage"> | undefined
) {
  if (storageId) {
    await ctx.scheduler.runAfter(0, internal.crm.storageReferences.deleteIfUnreferenced, {
      storageId,
    });
  }
}

/** A dry-run page: counts only, behind the deployment's migration secret, checked first. */
export async function reportRetentionPage(secret: string, planPage: () => Promise<RetentionPlan>) {
  assertMigrationSecret(secret);
  const plan = await planPage();
  return {
    continueCursor: plan.continueCursor,
    counts: tallyRetentionOutcomes(plan.decisions),
    isDone: plan.continueCursor === null,
  };
}

export const retentionCountsValidator = v.record(v.string(), v.number());

export const retentionRunResult = v.object({
  counts: retentionCountsValidator,
  scheduledContinuation: v.boolean(),
});

export const retentionContinuationArgs = {
  asOf: v.number(),
  cursor: v.string(),
};

export const retentionReportArgs = {
  /** The time the report evaluates; pass the current time (`Date.now()`). */
  asOf: v.number(),
  cursor: v.union(v.string(), v.null()),
  secret: v.string(),
};

export const retentionReportResult = v.object({
  continueCursor: v.union(v.string(), v.null()),
  counts: retentionCountsValidator,
  isDone: v.boolean(),
});

/**
 * Cursor for scans that walk several index ranges in turn: `<phase>:<page cursor>`, with an
 * empty page cursor at the start of a phase. Phase names never contain a colon.
 */
export function encodePhaseCursor(phase: string, cursor: string | null) {
  return `${phase}:${cursor ?? ""}`;
}

/** A decoded phased cursor: the phase and the page cursor within it (null at its start). */
export interface PhaseCursor<Phase extends string> {
  cursor: string | null;
  phase: Phase;
}

export function decodePhaseCursor<Phase extends string>(
  value: string | null,
  phases: readonly Phase[]
): PhaseCursor<Phase> {
  const [first] = phases;
  if (first === undefined) {
    throw new Error("A phased retention scan needs at least one phase");
  }
  if (value === null) {
    return { cursor: null, phase: first };
  }
  const phase = phases.find((candidate) => value.startsWith(`${candidate}:`));
  if (phase === undefined) {
    throw new Error("Invalid retention cursor");
  }
  const cursor = value.slice(phase.length + 1);
  return { cursor: cursor === "" ? null : cursor, phase };
}

/** The cursor after one page of a phased scan: same phase, next phase, or done. */
export function nextPhaseCursor<Phase extends string>(
  phases: readonly Phase[],
  phase: Phase,
  page: { continueCursor: string; isDone: boolean }
) {
  if (!page.isDone) {
    return encodePhaseCursor(phase, page.continueCursor);
  }
  const next = phases[phases.indexOf(phase) + 1];
  return next === undefined ? null : encodePhaseCursor(next, null);
}
