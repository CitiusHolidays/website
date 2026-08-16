import { describe, expect, spyOn, test } from "bun:test";
import type { FunctionReference } from "convex/server";
import type { ActionCtx } from "../_generated/server";
import type { AuthEmailDeliveryOutcome } from "../lib/authEmailDelivery";
import { propertiesWhen } from "../lib/runtimeValues";
import { createAuthOptions } from "./auth";

function createReceiptContext() {
  let receipt: AuthEmailDeliveryOutcome | null = null;
  const testCtx = {
    runAction: () => Promise.resolve(),
    runMutation: (
      _reference: FunctionReference<"query" | "mutation" | "action", "public" | "internal">,
      args: AuthEmailDeliveryOutcome
    ) => {
      const updatedAt = Date.now();
      receipt = {
        ...args,
        ...propertiesWhen(args.status === "sent", () => ({ sentAt: receipt?.sentAt ?? updatedAt })),
        updatedAt,
      };
      return Promise.resolve(receipt);
    },
    runQuery: () => Promise.resolve(receipt),
    scheduler: { runAfter: () => Promise.resolve() },
  };
  // SAFETY: this fake implements the ActionCtx operations used by the auth email callbacks.
  const ctx = testCtx as typeof testCtx & ActionCtx;
  return { ctx, getReceipt: () => receipt };
}

describe("Better Auth transactional email callbacks", () => {
  test("keeps the reset callback generic and logs only safe receipt metadata", async () => {
    const originalKey = process.env.RESEND_API_KEY;
    const originalFetch = globalThis.fetch;
    process.env.RESEND_API_KEY = "test-provider-key";
    globalThis.fetch = () => Promise.resolve(new Response(null, { status: 400 }));
    const consoleError = spyOn(console, "error").mockImplementation(() => undefined);
    const privateToken = "private-reset-token";
    const privateEmail = "private.person@example.com";
    const privateCallback =
      "http://localhost:3000/auth/reset-password?auth_delivery=opaque-reset-correlation";
    const callbackUrl = `http://localhost:3000/api/auth/reset-password/${privateToken}?callbackURL=${encodeURIComponent(privateCallback)}`;
    try {
      const { ctx, getReceipt } = createReceiptContext();
      const options = createAuthOptions(ctx);
      const callback = options.emailAndPassword?.sendResetPassword;
      expect(callback).toBeFunction();

      const result = await callback?.({
        token: privateToken,
        url: callbackUrl,
        user: {
          createdAt: new Date(),
          email: privateEmail,
          emailVerified: true,
          id: "auth-user",
          name: "Private Person",
          updatedAt: new Date(),
        },
      });

      expect(result).toBeUndefined();
      expect(getReceipt()).toMatchObject({
        attempts: 1,
        failureCode: "provider_rejected",
        purpose: "password_reset",
        status: "exhausted",
      });
      const logs = JSON.stringify(consoleError.mock.calls);
      expect(logs).toContain("auth_email_delivery_failed");
      expect(logs).not.toContain(privateEmail);
      expect(logs).not.toContain(privateToken);
      expect(logs).not.toContain(privateCallback);
      expect(logs).not.toContain("test-provider-key");
    } finally {
      consoleError.mockRestore();
      globalThis.fetch = originalFetch;
      if (originalKey === undefined) {
        delete process.env.RESEND_API_KEY;
      } else {
        process.env.RESEND_API_KEY = originalKey;
      }
    }
  });
});
