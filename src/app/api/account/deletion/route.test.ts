import { beforeEach, describe, expect, mock, test } from "bun:test";
import { ConvexError } from "convex/values";
import type { JsonValue } from "@/lib/jsonValue";

let authToken: string | null = "account-token";
const calls: Array<{ args: unknown; kind: string; options: unknown }> = [];
interface DeletionResult {
  deletedAt: number;
  reference: string;
  status: string;
}
interface Eligibility {
  reauthenticateBy?: number;
  status: string;
}
let mutationResult: DeletionResult = {
  deletedAt: 1,
  reference: "ABCDEF0123456789",
  status: "deleted",
};
let mutationFailure: Error | null = null;
let queryResult: Eligibility = { reauthenticateBy: 2, status: "ready" };

mock.module("@/lib/auth-server", () => ({
  fetchAuthMutation: (_ref: JsonValue, args: JsonValue, options: JsonValue) => {
    calls.push({ args, kind: "mutation", options });
    if (mutationFailure) {
      throw mutationFailure;
    }
    return mutationResult;
  },
  fetchAuthQuery: (_ref: JsonValue, args: JsonValue, options: JsonValue) => {
    calls.push({ args, kind: "query", options });
    return queryResult;
  },
  getToken: () => authToken,
}));

const { GET, POST } = await import("./route");

function post(body: string) {
  return POST(
    new Request("http://localhost/api/account/deletion", {
      body,
      headers: { "Content-Type": "application/json" },
      method: "POST",
    })
  );
}

beforeEach(() => {
  authToken = "account-token";
  calls.length = 0;
  mutationFailure = null;
  mutationResult = { deletedAt: 1, reference: "ABCDEF0123456789", status: "deleted" };
  queryResult = { reauthenticateBy: 2, status: "ready" };
});

describe("Account deletion route", () => {
  test("requires an authenticated Account request for both reads and deletion", async () => {
    authToken = null;

    const read = await GET(new Request("http://localhost/api/account/deletion"));
    const write = await post(JSON.stringify({ confirmation: "DELETE" }));

    expect(read.status).toBe(401);
    expect(write.status).toBe(401);
    expect(calls).toEqual([]);
  });

  test("returns the eligibility privately", async () => {
    const response = await GET(new Request("http://localhost/api/account/deletion"));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ reauthenticateBy: 2, status: "ready" });
    expect(calls).toEqual([
      {
        args: { referenceNow: expect.any(Number) },
        kind: "query",
        options: { token: "account-token" },
      },
    ]);
  });

  test("forwards only the typed confirmation and returns the receipt reference", async () => {
    const response = await post(JSON.stringify({ confirmation: "DELETE", userId: "someone" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      deletedAt: 1,
      reference: "ABCDEF0123456789",
      status: "deleted",
    });
    expect(calls).toEqual([
      { args: { confirmation: "DELETE" }, kind: "mutation", options: { token: "account-token" } },
    ]);
  });

  test("rejects a malformed body before calling the backend", async () => {
    const responses = await Promise.all(
      ["not json", "[]", JSON.stringify({ confirmation: 7 })].map(post)
    );
    for (const response of responses) {
      expect(response.status).toBe(400);
    }
    expect(await Promise.all(responses.map((response) => response.json()))).toEqual(
      Array.from({ length: 3 }, () => ({
        code: "confirmation_required",
        error: "Type DELETE to confirm.",
      }))
    );
    expect(calls).toEqual([]);
  });

  test("refuses a cross-site browser request before reading the session or calling the backend", async () => {
    const response = await POST(
      new Request("http://localhost/api/account/deletion", {
        body: JSON.stringify({ confirmation: "DELETE" }),
        headers: {
          "Content-Type": "text/plain",
          Origin: "https://attacker.example",
          "Sec-Fetch-Site": "cross-site",
        },
        method: "POST",
      })
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      code: "forbidden_origin",
      error: "Request origin not allowed.",
    });
    expect(calls).toEqual([]);
  });

  test("maps backend refusals to plain guidance without leaking details", async () => {
    const cases: [Error, number, string, string][] = [
      [
        new ConvexError("STAFF_ACCOUNT_DELETION_REFUSED"),
        403,
        "staff_account",
        "Staff logins can't be deleted from the Customer Travel Account. Contact HR to close your staff account.",
      ],
      [
        new ConvexError("REAUTHENTICATION_REQUIRED"),
        401,
        "reauthentication_required",
        "For your security, sign in again, then delete your account within 10 minutes.",
      ],
      [
        new ConvexError("AUTH_IDENTITY_CONFLICT"),
        409,
        "support_required",
        "We couldn't delete this account automatically. Contact the Citius team and we'll help.",
      ],
      [
        new Error("private backend detail"),
        500,
        "unavailable",
        "We couldn't delete your account just now. Nothing was changed. Please try again.",
      ],
    ];
    for (const [cause, status, code, error] of cases) {
      mutationFailure = cause;
      // biome-ignore lint/performance/noAwaitInLoops: each case sets the shared backend failure first.
      const response = await post(JSON.stringify({ confirmation: "DELETE" }));
      expect(response.status).toBe(status);
      expect(await response.json()).toEqual({ code, error });
    }
  });
});
