import { describe, expect, test } from "bun:test";
import { journeyPlannerResponseErrorMessage } from "./journeyPlannerStream";

describe("journey planner response errors", () => {
  test("extracts the safe API error instead of rendering raw JSON", async () => {
    const response = new Response(JSON.stringify({ error: "Journey planner is not configured." }), {
      status: 503,
    });

    await expect(journeyPlannerResponseErrorMessage(response)).resolves.toBe(
      "Journey planner is not configured."
    );
  });

  test("uses a stable fallback for an empty provider response", async () => {
    const response = new Response(null, { status: 503 });

    await expect(journeyPlannerResponseErrorMessage(response)).resolves.toBe(
      "Journey planner could not complete that response. Please try again."
    );
  });

  test("does not surface an unstructured JSON body", async () => {
    const response = new Response('{"provider":"offline"}', { status: 500 });

    await expect(journeyPlannerResponseErrorMessage(response)).resolves.toBe(
      "Journey planner could not complete that response. Please try again."
    );
  });
});
