"use node";

import crypto from "node:crypto";
import { ConvexError, v } from "convex/values";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { type ActionCtx, action, internalAction } from "../_generated/server";
import { authComponent, createAuth } from "../betterAuth/auth";
import { createAuthEmailCorrelation, getAuthEmailDeliveryOutcome } from "../lib/authEmailDelivery";
import { resolveAuthOrigin } from "../lib/authOriginPolicy";
import { sendPasswordSetupEmail, sendVerificationEmail } from "../lib/betterAuthEmail";
import { findAuthUserByEmail } from "../lib/betterAuthLookup";
import {
  staffOnboardingResultValidator,
  successResultValidator,
} from "./staffSettingsReturnContracts";

function isExistingUserError(err: unknown) {
  let message = String(err);
  if (err instanceof Error) {
    ({ message } = err);
  } else if (typeof err === "object" && err && "message" in err) {
    message = String((err as { message?: string }).message);
  }
  const lower = message.toLowerCase();
  return lower.includes("already") || lower.includes("exists") || lower.includes("duplicate");
}

async function resolveCanonicalAuthUserId(ctx: ActionCtx, email: string, fallbackId?: string) {
  const authUser = await findAuthUserByEmail(ctx, email);
  if (authUser?._id) {
    return String(authUser._id);
  }
  return fallbackId;
}

async function ensureStaffAuthLink(
  ctx: ActionCtx,
  staffId: Id<"staffUsers">,
  email: string,
  name: string,
  authUserId?: string
) {
  const canonicalAuthUserId =
    (await resolveCanonicalAuthUserId(ctx, email, authUserId)) ?? authUserId;
  if (!canonicalAuthUserId) {
    return;
  }

  await ctx.runMutation(internal.crm.staff.linkAuthUserId, {
    authUserId: canonicalAuthUserId,
    email,
    name,
    staffId,
  });
  return canonicalAuthUserId;
}

type ProvisionResult =
  | { ok: true; step: "verification_sent" | "password_setup_sent" }
  | { ok: false; step: "error"; message: string };

const provisionResultValidator = v.union(
  v.object({
    ok: v.literal(true),
    step: v.union(v.literal("verification_sent"), v.literal("password_setup_sent")),
  }),
  v.object({ message: v.string(), ok: v.literal(false), step: v.literal("error") })
);

async function recoverExistingStaffAuth(
  ctx: ActionCtx,
  args: { staffId: Id<"staffUsers">; email: string; name: string },
  auth: ReturnType<typeof createAuth>
): Promise<ProvisionResult | null> {
  const [, , authUser] = await Promise.all([
    ctx.runMutation(internal.crm.staff.markPendingOnboarding, {
      staffId: args.staffId,
    }),
    ensureStaffAuthLink(ctx, args.staffId, args.email, args.name),
    findAuthUserByEmail(ctx, args.email),
  ]);
  if (authUser?.emailVerified) {
    const passwordDelivery = await sendPasswordSetupEmail(ctx, auth, args.email);
    if (passwordDelivery.sent) {
      await ctx.runMutation(internal.crm.staff.clearPendingPasswordSetup, {
        staffId: args.staffId,
      });
      return { ok: true, step: "password_setup_sent" };
    }
  }

  const verification = await sendVerificationEmail(ctx, auth, args.email);
  if (verification.sent) {
    return { ok: true, step: "verification_sent" };
  }
  const passwordDelivery = await sendPasswordSetupEmail(ctx, auth, args.email);
  return passwordDelivery.sent ? { ok: true, step: "password_setup_sent" } : null;
}

async function provisionStaffCore(
  ctx: ActionCtx,
  args: { staffId: Id<"staffUsers">; email: string; name: string }
): Promise<ProvisionResult> {
  const auth = createAuth(ctx);
  const tempPassword = `${crypto.randomUUID()}A1!`;
  const siteUrl = resolveAuthOrigin(process.env);
  const verificationCorrelation = await createAuthEmailCorrelation(
    "verification",
    `${siteUrl}/auth/email-verified`
  );

  try {
    const result = await auth.api.signUpEmail({
      body: {
        callbackURL: verificationCorrelation.callbackUrl,
        email: args.email,
        name: args.name,
        password: tempPassword,
      },
    });

    if (!result?.user) {
      return { message: "Failed to create auth user", ok: false, step: "error" };
    }

    const authUserId = await resolveCanonicalAuthUserId(ctx, args.email, result.user.id);
    if (!authUserId) {
      return { message: "Failed to resolve auth user", ok: false, step: "error" };
    }

    await ctx.runMutation(internal.crm.staff.linkAuthUserId, {
      authUserId,
      email: args.email,
      name: args.name,
      staffId: args.staffId,
    });

    await ctx.runMutation(internal.crm.staff.markPendingOnboarding, {
      staffId: args.staffId,
    });

    const delivery = await getAuthEmailDeliveryOutcome(
      ctx,
      verificationCorrelation.correlationDigest
    );
    if (delivery?.status !== "sent") {
      return { message: "Verification email delivery failed", ok: false, step: "error" };
    }

    return { ok: true, step: "verification_sent" };
  } catch (err) {
    if (isExistingUserError(err)) {
      const recovery = await recoverExistingStaffAuth(ctx, args, auth);
      if (recovery) {
        return recovery;
      }
    }
    console.error(
      JSON.stringify({
        event: "staff_provision_failed",
        failureCode: isExistingUserError(err) ? "existing_user_recovery_failed" : "auth_api_failed",
      })
    );
    return {
      message: "Authentication provisioning failed",
      ok: false,
      step: "error",
    };
  }
}

export const provisionStaffUser = internalAction({
  args: {
    email: v.string(),
    name: v.string(),
    staffId: v.id("staffUsers"),
  },
  handler: async (ctx, args) => provisionStaffCore(ctx, args),
  returns: provisionResultValidator,
});

export const sendPasswordSetupAfterVerification = internalAction({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const staff = await ctx.runQuery(internal.crm.staff.getStaffPendingPasswordSetup, {
      email: args.email,
    });
    if (!staff) {
      return { reason: "staff_not_pending" as const, sent: false };
    }

    await ensureStaffAuthLink(ctx, staff.staffId, staff.email, staff.name, staff.authUserId);

    const auth = createAuth(ctx);
    const delivery = await sendPasswordSetupEmail(ctx, auth, args.email);
    if (!delivery.sent) {
      console.error(
        JSON.stringify({ event: "staff_password_setup_delivery_failed", reason: delivery.reason })
      );
      return { reason: delivery.reason, sent: false };
    }

    await ctx.runMutation(internal.crm.staff.clearPendingPasswordSetup, {
      staffId: staff.staffId,
    });

    return { sent: true };
  },
  returns: v.object({ reason: v.optional(v.string()), sent: v.boolean() }),
});

export const startStaffOnboarding = action({
  args: {
    staffId: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await ctx.runQuery(api.crm.staff.getMyPortalAccess);
    if (!(access?.allowed && access.permissions.includes("manage:staff"))) {
      throw new ConvexError("FORBIDDEN");
    }

    const staffId = args.staffId as Id<"staffUsers">;
    const staff = await ctx.runQuery(internal.crm.staff.getStaffForOnboarding, {
      staffId,
    });
    if (!staff) {
      throw new ConvexError("Staff member not found");
    }

    if (!staff.authUserId) {
      const result = await provisionStaffCore(ctx, {
        email: staff.email,
        name: staff.name,
        staffId: staff.staffId,
      });
      if (!result.ok) {
        throw new ConvexError(result.message ?? "Failed to start onboarding");
      }
      return {
        message:
          result.step === "password_setup_sent"
            ? "Password setup email sent."
            : "Verification email sent. They must verify before setting a password.",
        step: result.step as "verification_sent" | "password_setup_sent",
      };
    }

    await ctx.runMutation(internal.crm.staff.markPendingOnboarding, {
      staffId: staff.staffId,
    });

    const auth = createAuth(ctx);
    const linkedAuthUserId = await ensureStaffAuthLink(
      ctx,
      staff.staffId,
      staff.email,
      staff.name,
      staff.authUserId
    );

    let emailVerified = false;
    if (linkedAuthUserId) {
      const authUser = await authComponent.getAnyUserById(ctx, linkedAuthUserId);
      emailVerified = Boolean(authUser?.emailVerified);
    } else {
      const authUser = await findAuthUserByEmail(ctx, staff.email);
      emailVerified = Boolean(authUser?.emailVerified);
    }

    if (emailVerified) {
      const passwordDelivery = await sendPasswordSetupEmail(ctx, auth, staff.email);
      if (!passwordDelivery.sent) {
        throw new ConvexError("Failed to send password setup email");
      }
      await ctx.runMutation(internal.crm.staff.clearPendingPasswordSetup, {
        staffId: staff.staffId,
      });
      return {
        message: "Password setup email sent.",
        step: "password_setup_sent" as const,
      };
    }

    const verification = await sendVerificationEmail(ctx, auth, staff.email);
    if (verification.sent) {
      return {
        message:
          "Verification email sent. After they verify, they will receive a password setup link.",
        step: "verification_sent" as const,
      };
    }

    const passwordDelivery = await sendPasswordSetupEmail(ctx, auth, staff.email);
    if (!passwordDelivery.sent) {
      throw new ConvexError("Failed to send onboarding email");
    }

    await ctx.runMutation(internal.crm.staff.clearPendingPasswordSetup, {
      staffId: staff.staffId,
    });

    return {
      message: "Password setup email sent.",
      step: "password_setup_sent" as const,
    };
  },
  returns: staffOnboardingResultValidator,
});

/** @deprecated Use startStaffOnboarding — kept for compatibility */
export const adminSendResetEmail = action({
  args: {
    email: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await ctx.runQuery(api.crm.staff.getMyPortalAccess);
    if (!(access?.allowed && access.permissions.includes("manage:staff"))) {
      throw new ConvexError("FORBIDDEN");
    }

    const auth = createAuth(ctx);
    const delivery = await sendPasswordSetupEmail(ctx, auth, args.email);
    if (!delivery.sent) {
      throw new ConvexError("Failed to send reset password email");
    }

    return { success: true as const };
  },
  returns: successResultValidator,
});
