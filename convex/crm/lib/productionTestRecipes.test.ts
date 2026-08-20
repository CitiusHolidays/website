import { describe, expect, test } from "bun:test";
import { Effect, Layer } from "effect";
import { assertProductionTestEffectIsRedacted } from "../productionTestLab";
import {
  DryRunProbe,
  PRODUCTION_TEST_RECIPES,
  RecipeProbeFailure,
  runProductionTestRecipes,
} from "./productionTestRecipes";

describe("Production Test Lab recipe orchestration", () => {
  test("rejects sensitive values before recording Test Lab evidence", () => {
    expect(() => assertProductionTestEffectIsRedacted("recipient=person@example.com")).toThrow();
    expect(() => assertProductionTestEffectIsRedacted("token=customer-secret")).toThrow();
    expect(() => assertProductionTestEffectIsRedacted("card 4111 1111 1111 1111")).toThrow();
    expect(() =>
      assertProductionTestEffectIsRedacted("Provider request suppressed; recipient=redacted")
    ).not.toThrow();
  });

  test("registers only major side-effect-free capabilities", () => {
    expect(PRODUCTION_TEST_RECIPES.map((recipe) => recipe.id)).toEqual([
      "inbound_leads",
      "auth_email",
      "crm_notifications",
      "concierge",
      "journey_planner",
      "razorpay_new_order",
      "document_preview",
      "sacred_bharat_publication",
      "scheduled_job:check_cl_sl_leave_lapse",
      "scheduled_job:cleanup_ai_runtime",
      "scheduled_job:cleanup_passenger_exports",
      "scheduled_job:cleanup_portal_rate_limits",
      "scheduled_job:cleanup_sacred_bharat_rate_limits",
      "scheduled_job:purge_commercial_files",
      "scheduled_job:reconcile_crm_metrics",
      "scheduled_job:reconcile_list_search",
      "scheduled_job:reconcile_proposal_links",
      "scheduled_job:reconcile_proposal_relations",
      "scheduled_job:reconcile_query_commercial",
      "scheduled_job:run_workflow_nudges",
    ]);
  });

  test("reports Passed, Failed, and Skipped and always runs cleanup", async () => {
    const cleaned: string[] = [];
    const layer = Layer.succeed(
      DryRunProbe,
      DryRunProbe.of({
        cleanup: (recipe) => Effect.sync(() => cleaned.push(recipe.id)),
        run: (recipe) => {
          if (recipe.id === "auth_email") {
            return Effect.fail(
              new RecipeProbeFailure({ detail: "Template contract failed", recipeId: recipe.id })
            );
          }
          return Effect.succeed(
            recipe.id === "concierge"
              ? {
                  detail: "Paused by live feature controls",
                  recordedEffects: [],
                  status: "skipped" as const,
                }
              : {
                  detail: "Dry-run contract passed",
                  recordedEffects: [`${recipe.id} recording boundary reached`],
                  status: "passed" as const,
                }
          );
        },
      })
    );

    const result = await Effect.runPromise(
      runProductionTestRecipes(["inbound_leads", "auth_email", "concierge"]).pipe(
        Effect.provide(layer)
      )
    );

    expect(result.map((entry) => entry.status)).toEqual(["passed", "failed", "skipped"]);
    expect(result.every((entry) => entry.cleanup === "passed")).toBe(true);
    expect(result[0]?.steps.map((step) => step.status)).toEqual([
      "passed",
      "passed",
      "passed",
      "passed",
    ]);
    expect(result[0]?.recordedEffects).toContain("inbound_leads recording boundary reached");
    expect(cleaned).toEqual(["inbound_leads", "auth_email", "concierge"]);
  });

  test("continues independent recipes when one cleanup fails", async () => {
    const ran: string[] = [];
    const layer = Layer.succeed(
      DryRunProbe,
      DryRunProbe.of({
        cleanup: (recipe) =>
          recipe.id === "inbound_leads"
            ? Effect.fail(new RecipeProbeFailure({ detail: "Cleanup failed", recipeId: recipe.id }))
            : Effect.void,
        run: (recipe) =>
          Effect.sync(() => {
            ran.push(recipe.id);
            return {
              detail: "Reached recording boundary",
              recordedEffects: [`${recipe.id} recording boundary reached`],
              status: "passed" as const,
            };
          }),
      })
    );

    const result = await Effect.runPromise(
      runProductionTestRecipes(["inbound_leads", "auth_email"]).pipe(Effect.provide(layer))
    );

    expect(result.map((entry) => entry.status)).toEqual(["failed", "passed"]);
    expect(ran).toEqual(["inbound_leads", "auth_email"]);
  });

  test("times out a stalled boundary, interrupts it, and still performs cleanup", async () => {
    const cleaned: string[] = [];
    const layer = Layer.succeed(
      DryRunProbe,
      DryRunProbe.of({
        cleanup: (recipe) => Effect.sync(() => cleaned.push(recipe.id)),
        run: () => Effect.never,
      })
    );

    const [result] = await Effect.runPromise(
      runProductionTestRecipes(["concierge"], { timeoutMs: 1 }).pipe(Effect.provide(layer))
    );

    expect(result).toMatchObject({ cleanup: "passed", status: "failed" });
    expect(result?.steps.find((step) => step.id === "record-effects")?.status).toBe("skipped");
    expect(cleaned).toEqual(["concierge"]);
  });
});
