"use node";

import crypto from "node:crypto";
import { ConvexError, v } from "convex/values";
import { api, components, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { type ActionCtx, action, internalAction } from "../_generated/server";
import { authComponent, createAuth } from "../betterAuth/auth";
import { normalizeEmail } from "./lib";

function getSiteUrl() {
  return process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

function isExistingUserError(err: unknown) {
  const message =
    err instanceof Error
      ? err.message
      : typeof err === "object" && err && "message" in err
        ? String((err as { message?: string }).message)
        : String(err);
  const lower = message.toLowerCase();
  return lower.includes("already") || lower.includes("exists") || lower.includes("duplicate");
}

async function sendVerificationEmail(auth: ReturnType<typeof createAuth>, email: string) {
  const siteUrl = getSiteUrl();
  const callbackURL = `${siteUrl}/auth/email-verified`;
  const api = auth.api as {
    sendVerificationEmail?: (input: {
      body: { email: string; callbackURL?: string };
    }) => Promise<{ status?: boolean } | undefined>;
  };
  if (!api.sendVerificationEmail) {
    return { sent: false, reason: "verification_api_unavailable" as const };
  }
  const result = await api.sendVerificationEmail({
    body: { email, callbackURL },
  });
  return { sent: Boolean(result?.status ?? true), reason: "verification" as const };
}

async function findAuthUserByEmail(ctx: ActionCtx, email: string) {
  const emailNormalized = normalizeEmail(email);
  const candidates = [emailNormalized, email.trim()];
  const authUsers = await Promise.all(
    candidates.map((candidate) =>
      ctx.runQuery(components.betterAuth.adapter.findOne, {
        model: "user",
        where: [{ field: "email", value: candidate }],
      }),
    ),
  );
  for (const authUser of authUsers) {
    if (authUser && typeof authUser === "object" && "_id" in authUser) {
      return authUser as { _id: string; emailVerified?: boolean; email?: string };
    }
  }
  return null;
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
  authUserId?: string,
) {
  const canonicalAuthUserId =
    (await resolveCanonicalAuthUserId(ctx, email, authUserId)) ?? authUserId;
  if (!canonicalAuthUserId) {
    return undefined;
  }

  await ctx.runMutation(internal.crm.staff.linkAuthUserId, {
    staffId,
    authUserId: canonicalAuthUserId,
    email,
    name,
  });
  return canonicalAuthUserId;
}

async function sendPasswordSetupEmail(auth: ReturnType<typeof createAuth>, email: string) {
  const siteUrl = getSiteUrl();
  const resetResult = await auth.api.requestPasswordReset({
    body: {
      email,
      redirectTo: `${siteUrl}/auth/reset-password`,
    },
  });
  return Boolean(resetResult?.status);
}

type ProvisionResult =
  | { ok: true; step: "verification_sent" | "password_setup_sent" }
  | { ok: false; step: "error"; message: string };

async function provisionStaffCore(
  ctx: ActionCtx,
  args: { staffId: Id<"staffUsers">; email: string; name: string },
): Promise<ProvisionResult> {
  const auth = createAuth(ctx);
  const tempPassword = `${crypto.randomUUID()}A1!`;
  const siteUrl = getSiteUrl();
  const callbackURL = `${siteUrl}/auth/email-verified`;

  try {
    const result = await auth.api.signUpEmail({
      body: {
        email: args.email,
        password: tempPassword,
        name: args.name,
        callbackURL,
      },
    });

    if (!result?.user) {
      return { ok: false, step: "error", message: "Failed to create auth user" };
    }

    const authUserId = await resolveCanonicalAuthUserId(ctx, args.email, result.user.id);
    if (!authUserId) {
      return { ok: false, step: "error", message: "Failed to resolve auth user" };
    }

    await ctx.runMutation(internal.crm.staff.linkAuthUserId, {
      staffId: args.staffId,
      authUserId,
      email: args.email,
      name: args.name,
    });

    await ctx.runMutation(internal.crm.staff.markPendingOnboarding, {
      staffId: args.staffId,
    });

    return { ok: true, step: "verification_sent" };
  } catch (err) {
    if (isExistingUserError(err)) {
      const [, , authUser] = await Promise.all([
        ctx.runMutation(internal.crm.staff.markPendingOnboarding, {
          staffId: args.staffId,
        }),
        ensureStaffAuthLink(ctx, args.staffId, args.email, args.name),
        findAuthUserByEmail(ctx, args.email),
      ]);
      if (authUser?.emailVerified) {
        const passwordSent = await sendPasswordSetupEmail(auth, args.email);
        if (passwordSent) {
          await ctx.runMutation(internal.crm.staff.clearPendingPasswordSetup, {
            staffId: args.staffId,
          });
          return { ok: true, step: "password_setup_sent" };
        }
      }

      const verification = await sendVerificationEmail(auth, args.email);
      if (verification.sent) {
        return { ok: true, step: "verification_sent" };
      }
      const passwordSent = await sendPasswordSetupEmail(auth, args.email);
      if (passwordSent) {
        return { ok: true, step: "password_setup_sent" };
      }
    }
    console.error("Staff provision error:", err);
    return {
      ok: false,
      step: "error",
      message: err instanceof Error ? err.message : "Provision failed",
    };
  }
}

export const provisionStaffUser = internalAction({
  args: {
    staffId: v.id("staffUsers"),
    email: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => provisionStaffCore(ctx, args),
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
      return { sent: false, reason: "staff_not_pending" as const };
    }

    await ensureStaffAuthLink(ctx, staff.staffId, staff.email, staff.name, staff.authUserId);

    const auth = createAuth(ctx);
    const sent = await sendPasswordSetupEmail(auth, args.email);
    if (!sent) {
      console.error("Failed to send staff password setup email for", args.email);
      return { sent: false, reason: "email_send_failed" as const };
    }

    await ctx.runMutation(internal.crm.staff.clearPendingPasswordSetup, {
      staffId: staff.staffId,
    });

    return { sent: true };
  },
});

export const startStaffOnboarding = action({
  args: {
    staffId: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await ctx.runQuery(api.crm.staff.getMyPortalAccess);
    if (!access?.allowed || !access.permissions.includes("manage:staff")) {
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
        staffId: staff.staffId,
        email: staff.email,
        name: staff.name,
      });
      if (!result.ok) {
        throw new ConvexError(result.message ?? "Failed to start onboarding");
      }
      return {
        step: result.step,
        message:
          result.step === "password_setup_sent"
            ? "Password setup email sent."
            : "Verification email sent. They must verify before setting a password.",
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
      staff.authUserId,
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
      const passwordSent = await sendPasswordSetupEmail(auth, staff.email);
      if (!passwordSent) {
        throw new ConvexError("Failed to send password setup email");
      }
      await ctx.runMutation(internal.crm.staff.clearPendingPasswordSetup, {
        staffId: staff.staffId,
      });
      return {
        step: "password_setup_sent",
        message: "Password setup email sent.",
      };
    }

    const verification = await sendVerificationEmail(auth, staff.email);
    if (verification.sent) {
      return {
        step: "verification_sent",
        message:
          "Verification email sent. After they verify, they will receive a password setup link.",
      };
    }

    const passwordSent = await sendPasswordSetupEmail(auth, staff.email);
    if (!passwordSent) {
      throw new ConvexError("Failed to send onboarding email");
    }

    await ctx.runMutation(internal.crm.staff.clearPendingPasswordSetup, {
      staffId: staff.staffId,
    });

    return {
      step: "password_setup_sent",
      message: "Password setup email sent.",
    };
  },
});

/** @deprecated Use startStaffOnboarding — kept for compatibility */
export const adminSendResetEmail = action({
  args: {
    email: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await ctx.runQuery(api.crm.staff.getMyPortalAccess);
    if (!access?.allowed || !access.permissions.includes("manage:staff")) {
      throw new ConvexError("FORBIDDEN");
    }

    const auth = createAuth(ctx);
    const sent = await sendPasswordSetupEmail(auth, args.email);
    if (!sent) {
      throw new ConvexError("Failed to send reset password email");
    }

    return { success: true };
  },
});
