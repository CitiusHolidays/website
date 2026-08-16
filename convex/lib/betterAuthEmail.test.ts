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
    runQuery: () => Promise.resolve(readReceipt()),
  };
  // SAFETY: this fake provides the only ActionCtx method exercised by the email adapter.
  return testCtx as typeof testCtx & ActionCtx;
}

describe("Better Auth email request outcomes", () => {
  test("does not infer password-reset delivery from the generic API response", async () => {
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

  test("reports sent only when the callback wrote the matching durable receipt", async () => {
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

  test("keeps an unavailable verification API distinct from provider delivery", async () => {
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
