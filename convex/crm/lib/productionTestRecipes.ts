import { Cause, Context, Effect, Exit, Option, Schema } from "effect";
import {
  SCHEDULED_JOBS,
  type ScheduledJob,
  scheduledJobControlKey,
} from "../../operationalScheduledJobs";
import type { OperationalControlKey } from "./operationalControls";

type CoreProductionTestRecipeId =
  | "inbound_leads"
  | "auth_email"
  | "crm_notifications"
  | "concierge"
  | "journey_planner"
  | "razorpay_new_order"
  | "document_preview"
  | "sacred_bharat_publication";

export type ProductionTestRecipeId = CoreProductionTestRecipeId | `scheduled_job:${ScheduledJob}`;

export interface ProductionTestRecipe {
  controls: readonly OperationalControlKey[];
  description: string;
  id: ProductionTestRecipeId;
  kind: CoreProductionTestRecipeId | "scheduled_job";
  label: string;
  scheduledJob?: ScheduledJob;
}

const CORE_PRODUCTION_TEST_RECIPES = [
  {
    controls: ["inbound.crm_intake"],
    description: "Validate the inbound-lead contract without creating a CRM lead or notifications.",
    id: "inbound_leads",
    kind: "inbound_leads",
    label: "Inbound leads",
  },
  {
    controls: ["email.auth.verification", "email.auth.password_reset", "email.auth.staff_setup"],
    description:
      "Validate authentication-email templates, routing, and fixed delivery failure modes without sending email.",
    id: "auth_email",
    kind: "auth_email",
    label: "Authentication email",
  },
  {
    controls: ["notifications.crm_bell", "email.crm_workflow"],
    description:
      "Validate CRM notification routing and fixed delivery failure modes without creating bell or email deliveries.",
    id: "crm_notifications",
    kind: "crm_notifications",
    label: "CRM notifications",
  },
  {
    controls: ["ai.concierge"],
    description: "Validate the Concierge request seam without calling an AI provider.",
    id: "concierge",
    kind: "concierge",
    label: "Citius Concierge",
  },
  {
    controls: ["ai.journey_planner"],
    description:
      "Retained only to report the retired Journey Planner control as unavailable without calling an AI provider.",
    id: "journey_planner",
    kind: "journey_planner",
    label: "Journey Planner (retired)",
  },
  {
    controls: ["payments.razorpay_new_order"],
    description: "Validate new-order preparation without creating a Razorpay order or booking.",
    id: "razorpay_new_order",
    kind: "razorpay_new_order",
    label: "New Razorpay order",
  },
  {
    controls: ["files.document_preview_preparation"],
    description: "Validate document-preview preparation without uploading or converting a file.",
    id: "document_preview",
    kind: "document_preview",
    label: "Document preview",
  },
  {
    controls: ["public.sacred_bharat_001"],
    description: "Validate the Sacred Bharat publication gate without recording player activity.",
    id: "sacred_bharat_publication",
    kind: "sacred_bharat_publication",
    label: "Sacred Bharat / 001",
  },
] as const satisfies readonly ProductionTestRecipe[];

function scheduledJobLabel(job: ScheduledJob) {
  return job
    .split("_")
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
}

export const PRODUCTION_TEST_RECIPES: readonly ProductionTestRecipe[] = [
  ...CORE_PRODUCTION_TEST_RECIPES,
  ...SCHEDULED_JOBS.map(
    (scheduledJob): ProductionTestRecipe => ({
      controls: [scheduledJobControlKey(scheduledJob)],
      description: `Validate ${scheduledJobLabel(scheduledJob)} through its real dispatch boundary without executing writes.`,
      id: `scheduled_job:${scheduledJob}`,
      kind: "scheduled_job",
      label: `Scheduled job — ${scheduledJobLabel(scheduledJob)}`,
      scheduledJob,
    })
  ),
];

const RECIPE_BY_ID = new Map(
  PRODUCTION_TEST_RECIPES.map((recipe): [ProductionTestRecipeId, ProductionTestRecipe] => [
    recipe.id,
    recipe,
  ])
);

export class RecipeProbeFailure extends Schema.TaggedError<RecipeProbeFailure>(
  "RecipeProbeFailure"
)("RecipeProbeFailure", {
  detail: Schema.String,
  recipeId: Schema.String,
}) {}

interface DryRunProbeService {
  cleanup: (recipe: ProductionTestRecipe) => Effect.Effect<void, RecipeProbeFailure>;
  run: (
    recipe: ProductionTestRecipe
  ) => Effect.Effect<
    { detail: string; recordedEffects: string[]; status: "passed" | "skipped" },
    RecipeProbeFailure
  >;
}

export class DryRunProbe extends Context.Service<DryRunProbe, DryRunProbeService>()(
  "@citius/ProductionTestLab/DryRunProbe"
) {}

export interface ProductionTestRecipeResult {
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

const UNSAFE_FAILURE_DETAIL =
  /(?:[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:secret|token|password|authorization)\s*=|(?:\d[ -]*?){12,19}|\bat\s+(?:async\s+)?\S+:\d+(?::\d+)?|\S+\.[cm]?[jt]sx?:\d+(?::\d+)?|[<>{}[\]]|[\r\n])/iu;

function safeFailureDetail(detail: string) {
  const trimmed = detail.trim();
  return trimmed && trimmed.length <= 240 && !UNSAFE_FAILURE_DETAIL.test(trimmed)
    ? trimmed
    : "The recording boundary failed without privacy-safe diagnostic detail.";
}

function failureDetail(exit: Exit.Exit<unknown, unknown>) {
  if (Exit.isSuccess(exit)) {
    return "Unknown recipe failure";
  }
  const failure = Cause.findErrorOption(exit.cause);
  return Option.isSome(failure) && failure.value instanceof RecipeProbeFailure
    ? safeFailureDetail(failure.value.detail)
    : "The recording boundary timed out or failed unexpectedly.";
}

interface ProbeOutcome {
  detail: string;
  recordedEffects: string[];
  status: "passed" | "skipped";
}

function unregisteredRecipeResult(
  recipeId: ProductionTestRecipeId,
  startedAt: number
): ProductionTestRecipeResult {
  return {
    cleanup: "passed",
    detail: "Recipe is not registered.",
    durationMs: Date.now() - startedAt,
    label: recipeId,
    recipeId,
    recordedEffects: [],
    status: "failed",
    steps: [
      {
        detail: "Recipe is not registered.",
        id: "recipe-registration",
        label: "Recipe registration",
        status: "failed",
      },
    ],
  };
}

function failedRecipeResult(
  recipe: ProductionTestRecipe,
  recipeId: ProductionTestRecipeId,
  startedAt: number,
  outcome: Exit.Exit<ProbeOutcome, unknown>,
  cleanup: Exit.Exit<void, unknown>
): ProductionTestRecipeResult {
  const cleanupStatus = Exit.isSuccess(cleanup) ? "passed" : "failed";
  const detail = failureDetail(outcome);
  return {
    cleanup: cleanupStatus,
    detail,
    durationMs: Date.now() - startedAt,
    label: recipe.label,
    recipeId,
    recordedEffects: [],
    status: "failed",
    steps: [
      {
        detail: "Recipe registration and immutable input validation passed.",
        id: "validate-input",
        label: "Validate the recipe input",
        status: "passed",
      },
      {
        detail,
        id: "safe-boundary",
        label: "Reach the controlled effect boundary",
        status: "failed",
      },
      {
        detail: "Dependent recording boundaries were not reached.",
        id: "record-effects",
        label: "Record suppressed effects",
        status: "skipped",
      },
      {
        detail: cleanupStatus === "passed" ? "Cleanup completed." : failureDetail(cleanup),
        id: "cleanup",
        label: "Clean up test state",
        status: cleanupStatus,
      },
    ],
  };
}

function completedRecipeResult(
  recipe: ProductionTestRecipe,
  recipeId: ProductionTestRecipeId,
  startedAt: number,
  outcome: ProbeOutcome,
  cleanup: Exit.Exit<void, unknown>
): ProductionTestRecipeResult {
  const cleanupStatus = Exit.isSuccess(cleanup) ? "passed" : "failed";
  return {
    cleanup: cleanupStatus,
    detail: outcome.detail,
    durationMs: Date.now() - startedAt,
    label: recipe.label,
    recipeId,
    recordedEffects: outcome.recordedEffects,
    status: cleanupStatus === "failed" ? "failed" : outcome.status,
    steps: [
      {
        detail: "Recipe registration and immutable input validation passed.",
        id: "validate-input",
        label: "Validate the recipe input",
        status: "passed",
      },
      {
        detail: outcome.detail,
        id: "safe-boundary",
        label: "Reach the controlled effect boundary",
        status: outcome.status,
      },
      {
        detail:
          outcome.status === "passed"
            ? `${outcome.recordedEffects.length} redacted effect boundaries recorded without execution.`
            : "Dependent recording boundaries were skipped because the live capability is paused, blocked, or unavailable.",
        id: "record-effects",
        label: "Record suppressed effects",
        status: outcome.status,
      },
      {
        detail: cleanupStatus === "passed" ? "Cleanup completed." : failureDetail(cleanup),
        id: "cleanup",
        label: "Clean up test state",
        status: cleanupStatus,
      },
    ],
  };
}

function runProductionTestRecipe(
  recipeId: ProductionTestRecipeId,
  probe: DryRunProbeService,
  timeoutMs: number
): Effect.Effect<ProductionTestRecipeResult> {
  return Effect.gen(function* () {
    const startedAt = Date.now();
    const recipe = RECIPE_BY_ID.get(recipeId);
    if (!recipe) {
      return unregisteredRecipeResult(recipeId, startedAt);
    }
    const outcome = yield* Effect.exit(probe.run(recipe).pipe(Effect.timeout(timeoutMs)));
    const cleanup = yield* Effect.exit(probe.cleanup(recipe));
    return Exit.isFailure(outcome)
      ? failedRecipeResult(recipe, recipeId, startedAt, outcome, cleanup)
      : completedRecipeResult(recipe, recipeId, startedAt, outcome.value, cleanup);
  });
}

export function runProductionTestRecipes(
  recipeIds: readonly ProductionTestRecipeId[],
  options: { timeoutMs?: number } = {}
) {
  const timeoutMs = options.timeoutMs ?? 5000;
  return Effect.gen(function* () {
    const probe = yield* DryRunProbe;
    return yield* Effect.forEach(
      recipeIds,
      (recipeId) => runProductionTestRecipe(recipeId, probe, timeoutMs),
      { concurrency: 1 }
    );
  });
}
