import {
  makeFunctionReference,
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { ConvexError, v } from "convex/values";
import { Effect, Layer } from "effect";
import type { Doc, Id } from "../_generated/dataModel";
import {
  type ActionCtx,
  action,
  internalMutation,
  internalQuery,
  query,
} from "../_generated/server";
import { requireOperationalAdmin } from "./lib/operationalAdminAccess";
import { resolveOperationalControls } from "./lib/operationalControls";
import {
  assertOperationalTargetIdentity,
  operationalTargetIdentity,
} from "./lib/operationalTargetIdentity";
import { executeProductionTestRecipe } from "./lib/productionTestExecution";
import {
  DryRunProbe,
  PRODUCTION_TEST_RECIPES,
  type ProductionTestRecipeId,
  RecipeProbeFailure,
  runProductionTestRecipes,
} from "./lib/productionTestRecipes";
import { boundedPaginationOptions } from "./paginationPolicy";

const recipeIdValidator = v.union(
  v.literal("inbound_leads"),
  v.literal("auth_email"),
  v.literal("crm_notifications"),
  v.literal("concierge"),
  v.literal("journey_planner"),
  v.literal("razorpay_new_order"),
  v.literal("document_preview"),
  v.literal("sacred_bharat_publication"),
  v.literal("scheduled_job:check_cl_sl_leave_lapse"),
  v.literal("scheduled_job:cleanup_ai_runtime"),
  v.literal("scheduled_job:cleanup_passenger_exports"),
  v.literal("scheduled_job:cleanup_portal_rate_limits"),
  v.literal("scheduled_job:cleanup_sacred_bharat_rate_limits"),
  v.literal("scheduled_job:purge_commercial_files"),
  v.literal("scheduled_job:reconcile_crm_metrics"),
  v.literal("scheduled_job:reconcile_list_search"),
  v.literal("scheduled_job:reconcile_proposal_links"),
  v.literal("scheduled_job:reconcile_proposal_relations"),
  v.literal("scheduled_job:reconcile_query_commercial"),
  v.literal("scheduled_job:run_workflow_nudges")
);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_ADDRESS_PATTERN = /[\w.+-]+@[\w.-]+\.[a-z]{2,}/iu;
const SENSITIVE_ASSIGNMENT_PATTERN = /(?:secret|token|password|authorization)\s*=/iu;
const PAYMENT_CARD_PATTERN = /\b(?:\d[ -]*?){12,19}\b/u;
const INTERRUPTED_RUN_TIMEOUT_MS = 15 * 60 * 1000;

function assertRunInput(commandId: string, recipeIds: ProductionTestRecipeId[]) {
  if (
    !UUID_PATTERN.test(commandId) ||
    recipeIds.length === 0 ||
    recipeIds.length > PRODUCTION_TEST_RECIPES.length ||
    new Set(recipeIds).size !== recipeIds.length
  ) {
    throw new ConvexError("INVALID_PRODUCTION_TEST_RUN");
  }
}

function actorIdFor(access: Awaited<ReturnType<typeof requireOperationalAdmin>>) {
  return access.authUserId ?? String(access.staffId);
}

const recipeStepValidator = v.object({
  detail: v.string(),
  id: v.string(),
  label: v.string(),
  status: v.union(v.literal("failed"), v.literal("passed"), v.literal("skipped")),
});

const recipeResultValidator = v.object({
  cleanup: v.union(v.literal("failed"), v.literal("passed")),
  detail: v.string(),
  durationMs: v.number(),
  label: v.string(),
  recipeId: recipeIdValidator,
  recordedEffects: v.array(v.string()),
  status: v.union(v.literal("failed"), v.literal("passed"), v.literal("skipped")),
  steps: v.array(recipeStepValidator),
});

const runValidator = v.object({
  _creationTime: v.number(),
  _id: v.id("productionTestRuns"),
  actorId: v.string(),
  actorName: v.string(),
  commandId: v.string(),
  completedAt: v.optional(v.number()),
  note: v.optional(v.string()),
  recipeIds: v.array(recipeIdValidator),
  results: v.optional(v.array(recipeResultValidator)),
  startedAt: v.number(),
  status: v.union(v.literal("failed"), v.literal("passed"), v.literal("running")),
  targetDeployment: v.string(),
  targetEnvironment: v.string(),
  targetRevision: v.string(),
});

const completedRunValidator = v.object({
  ...runValidator.fields,
  completedAt: v.number(),
  results: v.array(recipeResultValidator),
  status: v.union(v.literal("failed"), v.literal("passed")),
});

function normalizedNote(note: string | undefined) {
  return note?.trim() || undefined;
}

function recipeForId(recipeId: ProductionTestRecipeId) {
  const recipe = PRODUCTION_TEST_RECIPES.find((candidate) => candidate.id === recipeId);
  if (!recipe) {
    throw new ConvexError("UNKNOWN_PRODUCTION_TEST_RECIPE");
  }
  return recipe;
}

export function assertProductionTestEffectIsRedacted(effect: string) {
  if (
    EMAIL_ADDRESS_PATTERN.test(effect) ||
    SENSITIVE_ASSIGNMENT_PATTERN.test(effect) ||
    PAYMENT_CARD_PATTERN.test(effect)
  ) {
    throw new RecipeProbeFailure({
      detail: "A recorded effect failed the redaction contract.",
      recipeId: "redaction",
    });
  }
}

function probeLayerFor(resolutions: Array<{ enabled: boolean; key: string }>) {
  const byKey = new Map(resolutions.map((resolution) => [resolution.key, resolution]));
  const recordings = new Map<ProductionTestRecipeId, string[]>();
  return Layer.succeed(
    DryRunProbe,
    DryRunProbe.of({
      cleanup: (recipe) =>
        Effect.try({
          catch: () =>
            new RecipeProbeFailure({
              detail: "Could not clear the transient recording boundary.",
              recipeId: recipe.id,
            }),
          try: () => {
            if (!recordings.delete(recipe.id)) {
              throw new Error("PRODUCTION_TEST_RECORDING_MISSING");
            }
          },
        }),
      run: (recipe) =>
        Effect.tryPromise({
          catch: (cause) =>
            cause instanceof RecipeProbeFailure
              ? cause
              : new RecipeProbeFailure({
                  detail: cause instanceof Error ? cause.message : "Domain preparation failed.",
                  recipeId: recipe.id,
                }),
          try: async () => {
            recordings.set(recipe.id, []);
            const missing = recipe.controls.filter((key) => !byKey.has(key));
            if (missing.length > 0) {
              throw new RecipeProbeFailure({
                detail: `Missing runtime controls: ${missing.join(", ")}`,
                recipeId: recipe.id,
              });
            }
            const paused = recipe.controls.filter((key) => byKey.get(key)?.enabled !== true);
            if (paused.length > 0) {
              return {
                detail: `Skipped because these live feature controls are paused or blocked: ${paused.join(", ")}`,
                recordedEffects: [],
                status: "skipped" as const,
              };
            }
            await executeProductionTestRecipe(recipe, (recordedEffect) => {
              assertProductionTestEffectIsRedacted(recordedEffect);
              recordings.get(recipe.id)?.push(recordedEffect);
              return Promise.resolve();
            });
            const recordedEffects = recordings.get(recipe.id) ?? [];
            return {
              detail: `Validated ${recipe.controls.length} runtime ${recipe.controls.length === 1 ? "gate" : "gates"}, domain preparation, and final recording boundaries. No business write or external request ran.`,
              recordedEffects: [...recordedEffects],
              status: "passed" as const,
            };
          },
        }),
    })
  );
}

interface RecipeResult {
  cleanup: "failed" | "passed";
  detail: string;
  durationMs: number;
  label: string;
  recipeId: ProductionTestRecipeId;
  recordedEffects: string[];
  status: "failed" | "passed" | "skipped";
  steps: Array<{
    detail: string;
    id: string;
    label: string;
    status: "failed" | "passed" | "skipped";
  }>;
}

type CompletedRun = Omit<Doc<"productionTestRuns">, "completedAt" | "results" | "status"> & {
  completedAt: number;
  results: RecipeResult[];
  status: "failed" | "passed";
};

const beginRunRef = makeFunctionReference<
  "mutation",
  {
    commandId: string;
    expectedTargetDeployment: string;
    expectedTargetEnvironment: string;
    expectedTargetRevision: string;
    note?: string;
    recipeIds: ProductionTestRecipeId[];
  },
  { replayed: boolean; runId: Id<"productionTestRuns">; status: "failed" | "passed" | "running" }
>("crm/productionTestLab:beginRun");
const prepareRunRef = makeFunctionReference<
  "query",
  { runId: Id<"productionTestRuns"> },
  {
    recipeIds: ProductionTestRecipeId[];
    resolutions: Array<{ enabled: boolean; key: string }>;
    status: "failed" | "passed" | "running";
  }
>("crm/productionTestLab:prepareRun");
const completeRunRef = makeFunctionReference<
  "mutation",
  { results: RecipeResult[]; runId: Id<"productionTestRuns"> },
  { run: CompletedRun }
>("crm/productionTestLab:completeRun");

export const listRecipes = query({
  args: {},
  handler: async (ctx) => {
    await requireOperationalAdmin(ctx);
    return PRODUCTION_TEST_RECIPES.map((recipe) => ({
      controls: [...recipe.controls],
      description: recipe.description,
      id: recipe.id,
      label: recipe.label,
    }));
  },
  returns: v.array(
    v.object({
      controls: v.array(v.string()),
      description: v.string(),
      id: recipeIdValidator,
      label: v.string(),
    })
  ),
});

export const beginRun = internalMutation({
  args: {
    commandId: v.string(),
    expectedTargetDeployment: v.string(),
    expectedTargetEnvironment: v.string(),
    expectedTargetRevision: v.string(),
    note: v.optional(v.string()),
    recipeIds: v.array(recipeIdValidator),
  },
  handler: async (ctx, args) => {
    const access = await requireOperationalAdmin(ctx);
    const target = assertOperationalTargetIdentity(args);
    assertRunInput(args.commandId, args.recipeIds);
    const note = normalizedNote(args.note);
    const actorId = actorIdFor(access);
    const replayRows = await ctx.db
      .query("productionTestRuns")
      .withIndex("by_commandId", (index) => index.eq("commandId", args.commandId))
      .take(2);
    if (replayRows.length > 1) {
      throw new ConvexError("PRODUCTION_TEST_COMMAND_CONFLICT");
    }
    const [replay] = replayRows;
    if (replay) {
      if (
        replay.actorId !== actorId ||
        JSON.stringify(replay.recipeIds) !== JSON.stringify(args.recipeIds) ||
        replay.note !== note ||
        replay.targetDeployment !== target.targetDeployment ||
        replay.targetEnvironment !== target.targetEnvironment ||
        replay.targetRevision !== target.targetRevision
      ) {
        throw new ConvexError("PRODUCTION_TEST_COMMAND_CONFLICT");
      }
      return { replayed: true, runId: replay._id, status: replay.status };
    }

    const now = Date.now();
    const activeRuns = await ctx.db
      .query("productionTestRuns")
      .withIndex("by_actorId_status", (index) =>
        index.eq("actorId", actorId).eq("status", "running")
      )
      .take(PRODUCTION_TEST_RECIPES.length);
    const requestedRecipeIds = new Set(args.recipeIds);
    const interruptedRuns = activeRuns.filter(
      (run) =>
        run.startedAt <= now - INTERRUPTED_RUN_TIMEOUT_MS &&
        run.recipeIds.some((recipeId) => requestedRecipeIds.has(recipeId))
    );
    await Promise.all(
      interruptedRuns.map((run) =>
        ctx.db.patch("productionTestRuns", run._id, {
          completedAt: now,
          results: run.recipeIds.map((recipeId) => ({
            cleanup: "passed" as const,
            detail: "The previous run was interrupted before it could record a result.",
            durationMs: Math.max(0, now - run.startedAt),
            label: recipeForId(recipeId).label,
            recipeId,
            recordedEffects: [],
            status: "failed" as const,
            steps: [
              {
                detail: "The run exceeded the recovery window and was safely closed.",
                id: "interrupted",
                label: "Interrupted run closed",
                status: "failed" as const,
              },
            ],
          })),
          status: "failed",
        })
      )
    );
    const interruptedIds = new Set(interruptedRuns.map((run) => run._id));
    if (
      activeRuns.some(
        (run) =>
          !interruptedIds.has(run._id) &&
          run.recipeIds.some((recipeId) => requestedRecipeIds.has(recipeId))
      )
    ) {
      throw new ConvexError("PRODUCTION_TEST_RUN_ALREADY_ACTIVE");
    }
    const runId = await ctx.db.insert("productionTestRuns", {
      actorId,
      actorName: access.name,
      commandId: args.commandId,
      note,
      recipeIds: args.recipeIds,
      startedAt: now,
      status: "running",
      ...target,
    });
    return { replayed: false, runId, status: "running" as const };
  },
  returns: v.object({
    replayed: v.boolean(),
    runId: v.id("productionTestRuns"),
    status: v.union(v.literal("failed"), v.literal("passed"), v.literal("running")),
  }),
});

export const prepareRun = internalQuery({
  args: { runId: v.id("productionTestRuns") },
  handler: async (ctx, args) => {
    const access = await requireOperationalAdmin(ctx);
    const run = await ctx.db.get("productionTestRuns", args.runId);
    if (!(run && run.actorId === actorIdFor(access))) {
      throw new ConvexError("PRODUCTION_TEST_RUN_NOT_FOUND");
    }
    const target = operationalTargetIdentity();
    if (
      run.targetDeployment !== target.targetDeployment ||
      run.targetEnvironment !== target.targetEnvironment ||
      run.targetRevision !== target.targetRevision
    ) {
      throw new ConvexError("OPERATIONAL_CONTROL_TARGET_MISMATCH");
    }
    const recipes = run.recipeIds.map(recipeForId);
    const keys = Array.from(new Set(recipes.flatMap((recipe) => [...recipe.controls])));
    const resolutions = await resolveOperationalControls(ctx, keys, { at: Date.now() });
    return {
      recipeIds: run.recipeIds,
      resolutions: resolutions.map(({ enabled, key }) => ({ enabled, key })),
      status: run.status,
    };
  },
  returns: v.object({
    recipeIds: v.array(recipeIdValidator),
    resolutions: v.array(v.object({ enabled: v.boolean(), key: v.string() })),
    status: v.union(v.literal("failed"), v.literal("passed"), v.literal("running")),
  }),
});

export const completeRun = internalMutation({
  args: { results: v.array(recipeResultValidator), runId: v.id("productionTestRuns") },
  handler: async (ctx, args) => {
    const access = await requireOperationalAdmin(ctx);
    const run = await ctx.db.get("productionTestRuns", args.runId);
    if (!(run && run.actorId === actorIdFor(access))) {
      throw new ConvexError("PRODUCTION_TEST_RUN_NOT_FOUND");
    }
    if (run.status === "running") {
      await ctx.db.patch("productionTestRuns", run._id, {
        completedAt: Date.now(),
        results: args.results,
        status: args.results.some((result) => result.status === "failed") ? "failed" : "passed",
      });
    }
    const completed = await ctx.db.get("productionTestRuns", run._id);
    if (!(completed?.completedAt && completed.results && completed.status !== "running")) {
      throw new ConvexError("PRODUCTION_TEST_EVIDENCE_MISSING");
    }
    const completedRun: CompletedRun = {
      ...completed,
      completedAt: completed.completedAt,
      results: completed.results,
      status: completed.status,
    };
    return { run: completedRun };
  },
  returns: v.object({ run: completedRunValidator }),
});

async function executeRun(ctx: ActionCtx, runId: Id<"productionTestRuns">) {
  const prepared = await ctx.runQuery(prepareRunRef, { runId });
  if (prepared.status !== "running") {
    const completed = await ctx.runMutation(completeRunRef, { results: [], runId });
    return completed.run;
  }
  const results = await Effect.runPromise(
    runProductionTestRecipes(prepared.recipeIds).pipe(
      Effect.provide(probeLayerFor(prepared.resolutions))
    )
  );
  const completed = await ctx.runMutation(completeRunRef, { results, runId });
  return completed.run;
}

export const runRecipes = action({
  args: {
    commandId: v.string(),
    expectedTargetDeployment: v.string(),
    expectedTargetEnvironment: v.string(),
    expectedTargetRevision: v.string(),
    note: v.optional(v.string()),
    recipeIds: v.array(recipeIdValidator),
  },
  handler: async (ctx, args) => {
    const begun = await ctx.runMutation(beginRunRef, args);
    const run = await executeRun(ctx, begun.runId);
    return { replayed: begun.replayed, run };
  },
  returns: v.object({ replayed: v.boolean(), run: completedRunValidator }),
});

export const resumeRun = action({
  args: { runId: v.id("productionTestRuns") },
  handler: async (ctx, args) => {
    operationalTargetIdentity();
    return { run: await executeRun(ctx, args.runId) };
  },
  returns: v.object({ run: completedRunValidator }),
});

export const listActiveRuns = query({
  args: {},
  handler: async (ctx) => {
    const access = await requireOperationalAdmin(ctx);
    return await ctx.db
      .query("productionTestRuns")
      .withIndex("by_actorId_status", (index) =>
        index.eq("actorId", actorIdFor(access)).eq("status", "running")
      )
      .take(PRODUCTION_TEST_RECIPES.length);
  },
  returns: v.array(runValidator),
});

export const listRuns = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireOperationalAdmin(ctx);
    return await ctx.db
      .query("productionTestRuns")
      .withIndex("by_completedAt")
      .order("desc")
      .paginate(boundedPaginationOptions(args.paginationOpts));
  },
  returns: paginationResultValidator(runValidator),
});
