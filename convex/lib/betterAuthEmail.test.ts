import { describe, expect, test } from "bun:test";
import type { ActionCtx } from "../_generated/server";
import type { createAuth } from "../betterAuth/auth";
import { type AuthEmailDeliveryOutcome, authEmailCorrelationDigest } from "./authEmailDelivery";
import { sendPasswordSetupEmail, sendVerificationEmail } from "./betterAuthEmail";

function correlationFromCallback(callbackUrl: string) {
  return new URL(callbackUrl).searchParams.get("auth_delivery") ?? "";
}

function createContext(readReceipt: () => AuthEmailDeliveryOutcome | null) {
  const testCtx = {
    runMutation: () => Promise.resolve({ prepared: true }),
    runQuery: () => Promise.resolve(readReceipt()),
  };
  // SAFETY: this fake provides the ActionCtx methods exercised by the email adapter.
  return testCtx as typeof testCtx & ActionCtx;
}

describe("Better Auth email request outcomes", () => {
  test("Does not infer password-reset delivery from the generic API response", async () => {
    const ctx = createContext(() => null);
    const testAuth = {
      api: {
        requestPasswordReset: () => Promise.resolve({ status: true }),
      },
    };
    // SAFETY: this fake implements the Better Auth API method exercised by this scenario.
    const auth = testAuth as typeof testAuth & ReturnType<typeof createAuth>;

    expect(await sendPasswordSetupEmail(ctx, auth, "person@example.com")).toEqual({
      reason: "delivery_not_observed",
      sent: false,
    });
  });

  test("Binds staff setup intent without exposing a selectable control in the callback URL", async () => {
    const ctx = createContext(() => null);
    let redirectTo = "";
    const testAuth = {
      api: {
        requestPasswordReset: (input: { body: { redirectTo?: string } }) => {
          redirectTo = input.body.redirectTo ?? "";
          return Promise.resolve({ status: true });
        },
      },
    };
    // SAFETY: this fake implements the Better Auth API method exercised by this scenario.
    const auth = testAuth as typeof testAuth & ReturnType<typeof createAuth>;

    await sendPasswordSetupEmail(ctx, auth, "person@example.com");

    expect(new URL(redirectTo).searchParams.has("auth_delivery")).toBe(true);
    expect(new URL(redirectTo).searchParams.has("auth_control")).toBe(false);
  });

  test("Reports sent only when the callback wrote the matching durable receipt", async () => {
    let receipt: AuthEmailDeliveryOutcome | null = null;
    const ctx = createContext(() => receipt);
    const testAuth = {
      api: {
        requestPasswordReset: async (input: { body: { redirectTo?: string } }) => {
          const secret = correlationFromCallback(input.body.redirectTo ?? "");
          const correlationDigest = await authEmailCorrelationDigest("password_reset", secret);
          receipt = {
            attempts: 1,
            correlationDigest,
            expiresAt: Date.now() + 60_000,
            purpose: "password_reset",
            sentAt: Date.now(),
            status: "sent",
            updatedAt: Date.now(),
          };
          return { status: true };
        },
      },
    };
    // SAFETY: this fake implements the Better Auth API method exercised by this scenario.
    const auth = testAuth as typeof testAuth & ReturnType<typeof createAuth>;

    expect(await sendPasswordSetupEmail(ctx, auth, "person@example.com")).toEqual({
      reason: "password_reset",
      sent: true,
    });
  });

  test("Keeps an unavailable verification API distinct from provider delivery", async () => {
    const ctx = createContext(() => null);
    const testAuth = { api: {} };
    // SAFETY: the empty API surface intentionally exercises the unavailable-method branch.
    const auth = testAuth as typeof testAuth & ReturnType<typeof createAuth>;

    expect(await sendVerificationEmail(ctx, auth, "person@example.com")).toEqual({
      reason: "verification_api_unavailable",
      sent: false,
    });
  });
});
