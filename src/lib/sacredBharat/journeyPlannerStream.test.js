import { describe, expect, test } from "bun:test";
import { journeyPlannerResponseErrorMessage } from "./journeyPlannerStream";

describe("Journey planner response errors", () => {
  test("Does not render arbitrary JSON or plain response bodies", async () => {
    const privateFailure = "provider failed with secret-value";
    const response = new Response(JSON.stringify({ error: privateFailure }), { status: 503 });

    await expect(journeyPlannerResponseErrorMessage(response)).resolves.toBe(
      "Sacred Bharat Journey Planner could not complete that response. Please try again."
    );
    expect(
      await journeyPlannerResponseErrorMessage(
        new Response(privateFailure, {
          status: 502,
        })
      )
    ).not.toContain(privateFailure);
  });

  test("Uses a stable fallback for an empty provider response", async () => {
    const response = new Response(null, { status: 503 });

    await expect(journeyPlannerResponseErrorMessage(response)).resolves.toBe(
      "Sacred Bharat Journey Planner could not complete that response. Please try again."
    );
  });

  test("Does not surface an unstructured JSON body", async () => {
    const response = new Response('{"provider":"offline"}', { status: 500 });

    await expect(journeyPlannerResponseErrorMessage(response)).resolves.toBe(
      "Sacred Bharat Journey Planner could not complete that response. Please try again."
    );
  });

  test("Keeps rate-limit and oversized-request recovery specific", async () => {
    await expect(
      journeyPlannerResponseErrorMessage(new Response(null, { status: 429 }))
    ).resolves.toContain("try again shortly");
    await expect(
      journeyPlannerResponseErrorMessage(new Response(null, { status: 413 }))
    ).resolves.toContain("Shorten it");
  });
});
