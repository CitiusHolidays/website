import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { isRuntimeObject, isRuntimeString } from "../lib/runtimeValues";

const HOUR_MS = 60 * 60 * 1000;
const NUDGE_RUN_KEY = "scheduled";
export const WORKFLOW_NUDGE_STALE_MS = 15 * 60 * 1000;
export const WORKFLOW_NUDGE_MAX_RETRIES = 3;
const MAX_FAILURE_MESSAGE_LENGTH = 500;
const TRANSIENT_FAILURE_PATTERN =
  /429|connection|fetch|network|rate.?limit|temporar|timeout|unavailable/i;

export const WORKFLOW_NUDGE_REPEAT_HOURS = 24;
export const WORKFLOW_NUDGE_STAGES = [
  "queries",
  "jobCards",
  "travellers",
  "tickets",
  "invoices",
] as const;

export type WorkflowNudgeStage = (typeof WORKFLOW_NUDGE_STAGES)[number];
type NudgeRun = Doc<"portalWorkflowNudgeRuns">;
type NudgeRunStatus = NudgeRun["status"];

export interface NudgeRunPageResult {
  checked: number;
  sent: number;
  status: NudgeRunStatus;
}

export interface ProcessNudgeStagePageResult {
  checked: number;
  continueCursor: string;
  isDone: boolean;
  sent: number;
}

export type ProcessNudgeStagePage = (
  ctx: MutationCtx,
  stage: WorkflowNudgeStage,
  cursor: string | null,
  referenceNow: number
) => Promise<ProcessNudgeStagePageResult>;

export const nudgeRunResultValidator = v.object({
  checked: v.number(),
  sent: v.number(),
  status: v.union(
    v.literal("running" as const),
    v.literal("completed"),
    v.literal("failed"),
    v.literal("stale" as const)
  ),
});

export const nudgeRunStateValidator = v.object({
  checked: v.number(),
  consecutiveFailedRuns: v.number(),
  cursor: v.union(v.string(), v.null()),
  effectiveStatus: v.union(
    v.literal("running" as const),
    v.literal("completed"),
    v.literal("failed"),
    v.literal("stale" as const)
  ),
  failedAt: v.union(v.number(), v.null()),
  failureCode: v.union(v.string(), v.null()),
  failureKind: v.union(
    v.literal("deterministic" as const),
    v.literal("stale"),
    v.literal("transient" as const),
    v.null()
  ),
  failureMessage: v.union(v.string(), v.null()),
  healthStatus: v.union(
    v.literal("healthy" as const),
    v.literal("attention" as const),
    v.literal("degraded" as const)
  ),
  key: v.string(),
  lastRetryAt: v.union(v.number(), v.null()),
  previousFailure: v.union(
    v.object({
      code: v.string(),
      failedAt: v.number(),
      kind: v.union(v.literal("deterministic"), v.literal("stale"), v.literal("transient")),
    }),
    v.null()
  ),
  referenceNow: v.number(),
  retryCount: v.number(),
  sent: v.number(),
  stage: v.union(
    v.literal("queries" as const),
    v.literal("jobCards"),
    v.literal("travellers"),
    v.literal("tickets"),
    v.literal("invoices"),
    v.literal("complete")
  ),
  staleAt: v.union(v.number(), v.null()),
  startedAt: v.number(),
  status: v.union(
    v.literal("running"),
    v.literal("completed"),
    v.literal("failed"),
    v.literal("stale")
  ),
  updatedAt: v.number(),
});

export const nullableNudgeRunStateValidator = v.union(nudgeRunStateValidator, v.null());

export class WorkflowNudgeDispatchError<Original> extends Error {
  cause: Original;
  original: Original;
  sent: number;

  constructor(original: Original, sent: number) {
    super(errorMessage(original));
    this.cause = original;
    this.name = "WorkflowNudgeDispatchError";
    this.original = original;
    this.sent = sent;
  }
}

function errorMessage(cause: unknown) {
  if (cause instanceof Error) {
    return cause.message;
  }
  if (isRuntimeString(cause)) {
    return cause;
  }
  try {
    return JSON.stringify(cause);
  } catch {
    return "Unknown workflow nudge failure";
  }
}

export function classifyNudgeFailure(cause: unknown) {
  const original = cause instanceof WorkflowNudgeDispatchError ? cause.original : cause;
  const message = errorMessage(original).slice(0, MAX_FAILURE_MESSAGE_LENGTH);
  let data: unknown;
  if (original instanceof ConvexError) {
    ({ data } = original);
  } else if (original instanceof Error && "data" in original) {
    ({ data } = original);
  }
  let rawCode = "WORKFLOW_NUDGE_FAILURE";
  if (isRuntimeObject(data) && data && "code" in data) {
    rawCode = String(data.code);
  } else if (original instanceof Error) {
    rawCode = original.name;
  }
  const code = rawCode.slice(0, 80);
  const transient = TRANSIENT_FAILURE_PATTERN.test(`${code} ${message}`);
  return {
    code,
    kind: transient ? ("transient" as const) : ("deterministic" as const),
    message,
  };
}

export async function getNudgeRunRow(ctx: QueryCtx | MutationCtx, key: string) {
  return await ctx.db
    .query("portalWorkflowNudgeRuns")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
}

export function isNudgeRunStale(run: NudgeRun | null, referenceNow: number) {
  return run?.status === "running" && referenceNow - run.updatedAt >= WORKFLOW_NUDGE_STALE_MS;
}

function nudgeHealthStatus(consecutiveFailedRuns: number, effectiveStatus: NudgeRunStatus) {
  if (consecutiveFailedRuns >= 2) {
    return "degraded" as const;
  }
  if (effectiveStatus === "failed" || effectiveStatus === "stale") {
    return "attention" as const;
  }
  return "healthy" as const;
}

export function presentNudgeRun(run: NudgeRun | null, referenceNow: number) {
  if (!run) {
    return null;
  }
  const effectiveStatus = isNudgeRunStale(run, referenceNow) ? "stale" : run.status;
  const consecutiveFailedRuns = run.consecutiveFailedRuns ?? 0;
  const previousFailure =
    run.previousFailureCode && run.previousFailureKind && run.previousFailedAt
      ? {
          code: run.previousFailureCode,
          failedAt: run.previousFailedAt,
          kind: run.previousFailureKind,
        }
      : null;
  return {
    checked: run.checked,
    consecutiveFailedRuns,
    cursor: run.cursor,
    effectiveStatus,
    failedAt: run.failedAt ?? null,
    failureCode: run.failureCode ?? null,
    failureKind: run.failureKind ?? null,
    failureMessage: run.failureMessage ?? null,
    healthStatus: nudgeHealthStatus(consecutiveFailedRuns, effectiveStatus),
    key: run.key,
    lastRetryAt: run.lastRetryAt ?? null,
    previousFailure,
    referenceNow,
    retryCount: run.retryCount ?? 0,
    sent: run.sent,
    stage: run.stage,
    staleAt: run.staleAt ?? null,
    startedAt: run.startedAt,
    status: run.status,
    updatedAt: run.updatedAt,
  };
}

async function persistStaleRun(ctx: MutationCtx, run: NudgeRun, referenceNow: number) {
  const failureAlreadyCounted = run.failureCountedStartedAt === run.startedAt;
  const patch = {
    consecutiveFailedRuns: (run.consecutiveFailedRuns ?? 0) + (failureAlreadyCounted ? 0 : 1),
    failureCode: "STALE_RUN",
    failureCountedStartedAt: run.startedAt,
    failureKind: "stale" as const,
    failureMessage: "Workflow nudge progress exceeded the active-run timeout.",
    staleAt: referenceNow,
    status: "stale" as const,
    updatedAt: referenceNow,
  };
  await ctx.db.patch("portalWorkflowNudgeRuns", run._id, patch);
  return { ...run, ...patch };
}

export function isScheduledNudgeCadenceEligible(run: NudgeRun | null, referenceNow: number) {
  return (
    run?.key === NUDGE_RUN_KEY &&
    referenceNow >= run.startedAt + WORKFLOW_NUDGE_REPEAT_HOURS * HOUR_MS
  );
}

function previousFailureFields(run: NudgeRun | null) {
  if (
    run &&
    (run.status === "failed" || run.status === "stale") &&
    run.failureCode &&
    run.failureKind
  ) {
    return {
      previousFailedAt: run.failedAt ?? run.staleAt ?? run.updatedAt,
      previousFailureCode: run.failureCode,
      previousFailureKind: run.failureKind,
    };
  }
  return {
    previousFailedAt: run?.previousFailedAt,
    previousFailureCode: run?.previousFailureCode,
    previousFailureKind: run?.previousFailureKind,
  };
}

async function loadOrStartNudgeRun(
  ctx: MutationCtx,
  key: string,
  referenceNow: number,
  continuationToken?: number
) {
  let existing = await getNudgeRunRow(ctx, key);
  if (existing?.status === "running") {
    if (isNudgeRunStale(existing, referenceNow)) {
      existing = await persistStaleRun(ctx, existing, referenceNow);
      if (
        continuationToken !== undefined ||
        !isScheduledNudgeCadenceEligible(existing, referenceNow)
      ) {
        return { canProcess: false, run: existing };
      }
    } else {
      return {
        canProcess:
          continuationToken !== undefined &&
          continuationToken === (existing.continuationToken ?? 0),
        run: existing,
      };
    }
  }
  if (existing?.key === NUDGE_RUN_KEY && !isScheduledNudgeCadenceEligible(existing, referenceNow)) {
    return { canProcess: false, run: existing };
  }
  if (
    existing &&
    existing.key !== NUDGE_RUN_KEY &&
    (existing.status === "failed" || existing.status === "stale")
  ) {
    return { canProcess: false, run: existing };
  }
  if (continuationToken !== undefined) {
    return { canProcess: false, run: existing };
  }
  const payload = {
    checked: 0,
    consecutiveFailedRuns: existing?.consecutiveFailedRuns ?? 0,
    continuationToken: (existing?.continuationToken ?? 0) + 1,
    cursor: null,
    failedAt: undefined,
    failureCode: undefined,
    failureCountedStartedAt: undefined,
    failureKind: undefined,
    failureMessage: undefined,
    key,
    lastRetryAt: undefined,
    ...previousFailureFields(existing),
    referenceNow,
    retryCount: 0,
    sent: 0,
    stage: "queries" as const,
    staleAt: undefined,
    startedAt: referenceNow,
    status: "running" as const,
    updatedAt: referenceNow,
  };
  if (existing) {
    await ctx.db.patch("portalWorkflowNudgeRuns", existing._id, payload);
    return { canProcess: true, run: { ...existing, ...payload } };
  }
  const id = await ctx.db.insert("portalWorkflowNudgeRuns", payload);
  return { canProcess: true, run: { _creationTime: referenceNow, _id: id, ...payload } };
}

async function advanceNudgeRunPage(
  ctx: MutationCtx,
  key: string,
  referenceNow: number,
  run: NudgeRun,
  processPage: ProcessNudgeStagePage
) {
  // SAFETY: the persisted stage is validated against WORKFLOW_NUDGE_STAGES immediately before this assignment.
  const stage = run.stage as WorkflowNudgeStage;
  const page = await processPage(ctx, stage, run.cursor, run.referenceNow);
  try {
    let nextStage: WorkflowNudgeStage | "complete" = stage;
    if (page.isDone) {
      const nextIndex = WORKFLOW_NUDGE_STAGES.indexOf(stage) + 1;
      nextStage =
        nextIndex < WORKFLOW_NUDGE_STAGES.length ? WORKFLOW_NUDGE_STAGES[nextIndex] : "complete";
    }
    const nextCursor = page.isDone ? null : page.continueCursor;
    const status: NudgeRunStatus = nextStage === "complete" ? "completed" : "running";
    const nextToken = (run.continuationToken ?? 0) + 1;
    await ctx.db.patch("portalWorkflowNudgeRuns", run._id, {
      checked: run.checked + page.checked,
      consecutiveFailedRuns: status === "completed" ? 0 : (run.consecutiveFailedRuns ?? 0),
      continuationToken: nextToken,
      cursor: nextCursor,
      failedAt: undefined,
      failureCode: undefined,
      failureCountedStartedAt: status === "completed" ? undefined : run.failureCountedStartedAt,
      failureKind: undefined,
      failureMessage: undefined,
      sent: run.sent + page.sent,
      stage: nextStage,
      status,
      updatedAt: referenceNow,
    });
    if (status === "running") {
      await ctx.scheduler.runAfter(0, internal.crm.workflowNudges.runScheduledNudges, {
        continuationToken: nextToken,
        runKey: key,
      });
    }
    return { checked: page.checked, sent: page.sent, status };
  } catch (error) {
    // biome-ignore lint/style/useErrorCause: WorkflowNudgeDispatchError stores the original error and partial-send count
    throw new WorkflowNudgeDispatchError(error, page.sent);
  }
}

async function recordNudgeRunFailure(
  ctx: MutationCtx,
  key: string,
  referenceNow: number,
  run: NudgeRun,
  cause: unknown
): Promise<NudgeRunPageResult> {
  const diagnostic = classifyNudgeFailure(cause);
  const sent = cause instanceof WorkflowNudgeDispatchError ? cause.sent : 0;
  const retryCount = run.retryCount ?? 0;
  const willRetry = diagnostic.kind === "transient" && retryCount < WORKFLOW_NUDGE_MAX_RETRIES;
  const nextToken = (run.continuationToken ?? 0) + 1;
  await ctx.db.patch("portalWorkflowNudgeRuns", run._id, {
    consecutiveFailedRuns: willRetry
      ? (run.consecutiveFailedRuns ?? 0)
      : (run.consecutiveFailedRuns ?? 0) + (run.failureCountedStartedAt === run.startedAt ? 0 : 1),
    continuationToken: nextToken,
    failedAt: referenceNow,
    failureCode: diagnostic.code,
    failureCountedStartedAt: willRetry ? run.failureCountedStartedAt : run.startedAt,
    failureKind: diagnostic.kind,
    failureMessage: diagnostic.message,
    lastRetryAt: willRetry ? referenceNow : run.lastRetryAt,
    retryCount: willRetry ? retryCount + 1 : retryCount,
    sent: run.sent + sent,
    status: willRetry ? "running" : "failed",
    updatedAt: referenceNow,
  });
  if (willRetry) {
    await ctx.scheduler.runAfter(
      nudgeRetryDelayMs(retryCount),
      internal.crm.workflowNudges.runScheduledNudges,
      { continuationToken: nextToken, runKey: key }
    );
  }
  return {
    checked: 0,
    sent,
    status: willRetry ? "running" : "failed",
  };
}

export async function runNudgePage(
  ctx: MutationCtx,
  key: string,
  processPage: ProcessNudgeStagePage,
  referenceNow: number,
  continuationToken?: number
): Promise<NudgeRunPageResult> {
  const loaded = await loadOrStartNudgeRun(ctx, key, referenceNow, continuationToken);
  const { run } = loaded;
  if (!run) {
    return { checked: 0, sent: 0, status: "completed" };
  }
  if (!loaded.canProcess || run.stage === "complete" || run.status === "completed") {
    return { checked: 0, sent: 0, status: run.status };
  }
  try {
    return await advanceNudgeRunPage(ctx, key, referenceNow, run, processPage);
  } catch (error) {
    return await recordNudgeRunFailure(ctx, key, referenceNow, run, error);
  }
}

export function nudgeRetryDelayMs(completedRetries: number) {
  return 60_000 * 2 ** Math.max(0, Math.min(WORKFLOW_NUDGE_MAX_RETRIES - 1, completedRetries));
}

export async function classifyStaleNudgeRunState(
  ctx: MutationCtx,
  runKey: string,
  referenceNow: number
) {
  const run = await getNudgeRunRow(ctx, runKey);
  if (!run) {
    return null;
  }
  if (run.status !== "running") {
    return run;
  }
  if (!isNudgeRunStale(run, referenceNow)) {
    throw new ConvexError("NUDGE_RUN_ACTIVE");
  }
  return await persistStaleRun(ctx, run, referenceNow);
}

export async function retryNudgeRunState(ctx: MutationCtx, runKey: string, referenceNow: number) {
  let run = await getNudgeRunRow(ctx, runKey);
  if (!run) {
    throw new ConvexError("Workflow nudge run not found");
  }
  if (run.status === "running") {
    if (!isNudgeRunStale(run, referenceNow)) {
      return run;
    }
    run = await persistStaleRun(ctx, run, referenceNow);
  }
  if (run.status !== "failed" && run.status !== "stale") {
    return run;
  }
  const retryCount = run.retryCount ?? 0;
  if (retryCount >= WORKFLOW_NUDGE_MAX_RETRIES) {
    throw new ConvexError("NUDGE_RETRY_LIMIT");
  }
  const continuationToken = (run.continuationToken ?? 0) + 1;
  const patch = {
    continuationToken,
    lastRetryAt: referenceNow,
    retryCount: retryCount + 1,
    status: "running" as const,
    updatedAt: referenceNow,
  };
  await ctx.db.patch("portalWorkflowNudgeRuns", run._id, patch);
  await ctx.scheduler.runAfter(0, internal.crm.workflowNudges.runScheduledNudges, {
    continuationToken,
    runKey,
  });
  return { ...run, ...patch };
}
