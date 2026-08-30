import { beforeEach, describe, expect, mock, test } from "bun:test";
import { isJsonObject, type JsonValue } from "@/lib/jsonValue";

let authToken: string | null = "account-token";
let mutationFailure = false;
const mutationCalls: Array<{ args: unknown; options: unknown }> = [];
const PRIVATE_ERROR_PATTERN = /private-customer|database token|example\.com/i;

mock.module("@/lib/auth-server", () => ({
  fetchAuthMutation: (_mutation: JsonValue, args: JsonValue, options: JsonValue) => {
    mutationCalls.push({ args, options });
    if (mutationFailure) {
      throw new Error("database token private-customer@example.com");
    }
    const milestones = isJsonObject(args) ? args.milestones : undefined;
    return {
      active: true,
      available: true,
      maskedPhone: "••••0123",
      milestones,
      optedInAt: 1,
      optedOutAt: null,
    };
  },
  getToken: () => authToken,
}));

const { POST } = await import("./route");

function request(body: JsonValue, confirmedOfferId = "confirmedOffers_1") {
  return POST(
    new Request(`http://localhost/api/account/reminder-preferences/${confirmedOfferId}`, {
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
      method: "POST",
    }),
    { params: Promise.resolve({ confirmedOfferId }) }
  );
}

beforeEach(() => {
  authToken = "account-token";
  mutationFailure = false;
  mutationCalls.length = 0;
});

describe("Account journey reminder preference route", () => {
  test("requires Account authentication before any write", async () => {
    authToken = null;

    const response = await request({ milestones: ["arrival_pack_ready"] });

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await response.json()).toEqual({ error: "Authentication required" });
    expect(mutationCalls).toEqual([]);
  });

  test("rejects unknown, duplicate, or malformed choices before the backend", async () => {
    const responses = await Promise.all(
      [
        { milestones: ["marketing_campaign"] },
        { milestones: ["confirmed_stay_summary_ready"] },
        { milestones: ["arrival_pack_ready", "arrival_pack_ready"] },
        { milestones: "arrival_pack_ready" },
        {},
      ].map((body) => request(body))
    );
    const payloads = await Promise.all(responses.map((response) => response.json()));
    for (const [index, response] of responses.entries()) {
      expect(response.status).toBe(400);
      expect(payloads[index]).toEqual({ error: "Invalid reminder choices" });
    }
    const invalidJourney = await request({ milestones: [] }, "../private");
    expect(invalidJourney.status).toBe(404);
    expect(await invalidJourney.json()).toEqual({ error: "Journey not found" });
    expect(mutationCalls).toEqual([]);
  });

  test("forwards only the entitled journey and approved milestone choices", async () => {
    const response = await request({
      milestones: ["arrival_pack_ready", "confirmed_travel_summary_ready"],
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(mutationCalls).toEqual([
      {
        args: {
          confirmedOfferId: "confirmedOffers_1",
          milestones: ["arrival_pack_ready", "confirmed_travel_summary_ready"],
        },
        options: { token: "account-token" },
      },
    ]);
    expect(await response.json()).toEqual({
      reminders: {
        active: true,
        available: true,
        maskedPhone: "••••0123",
        milestones: ["arrival_pack_ready", "confirmed_travel_summary_ready"],
        optedInAt: 1,
        optedOutAt: null,
      },
    });
  });

  test("allows an explicit empty selection to opt out", async () => {
    const response = await request({ milestones: [] });

    expect(response.status).toBe(200);
    expect(mutationCalls[0]).toMatchObject({
      args: { confirmedOfferId: "confirmedOffers_1", milestones: [] },
    });
  });

  test("keeps backend and recipient details out of errors", async () => {
    mutationFailure = true;

    const response = await request({ milestones: ["arrival_pack_ready"] });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      error: "Reminder choices could not be saved. Please try again.",
    });
    expect(JSON.stringify(body)).not.toMatch(PRIVATE_ERROR_PATTERN);
  });
});
