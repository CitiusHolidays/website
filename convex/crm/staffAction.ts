"use node";

import { v } from "convex/values";
import { internalAction, action } from "../_generated/server";
import { api, internal } from "../_generated/api";
import { ConvexError } from "convex/values";
import { createAuth } from "../betterAuth/auth";
import crypto from "crypto";

function getSiteUrl() {
  return (
    process.env.SITE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000"
  );
}

export const provisionStaffUser = internalAction({
  args: {
    staffId: v.id("staffUsers"),
    email: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = createAuth(ctx);
    const tempPassword = crypto.randomUUID() + "A1!";
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

      if (!result || !result.user) {
        throw new Error("Failed to create Better Auth user");
      }

      const authUserId = result.user.id;

      await ctx.runMutation(internal.crm.staff.linkAuthUserId, {
        staffId: args.staffId,
        authUserId,
      });
    } catch (err: any) {
      console.error("Staff provision error:", err);
    }
  },
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
      return { sent: false };
    }

    const auth = createAuth(ctx);
    const siteUrl = getSiteUrl();
    const resetResult = await auth.api.requestPasswordReset({
      body: {
        email: args.email,
        redirectTo: `${siteUrl}/auth/reset-password`,
      },
    });

    if (!resetResult?.status) {
      console.error("Failed to send staff password setup email for", args.email);
      return { sent: false };
    }

    await ctx.runMutation(internal.crm.staff.clearPendingPasswordSetup, {
      staffId: staff.staffId,
    });

    return { sent: true };
  },
});

export const adminSendResetEmail = action({
  args: {
    email: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await ctx.runQuery(api.crm.staff.getMyPortalAccess);
    if (!access || !access.allowed || !access.permissions.includes("manage:staff")) {
      throw new ConvexError("FORBIDDEN");
    }

    const auth = createAuth(ctx);
    const siteUrl = getSiteUrl();
    const resetResult = await auth.api.requestPasswordReset({
      body: {
        email: args.email,
        redirectTo: `${siteUrl}/auth/reset-password`,
      },
    });

    if (!resetResult?.status) {
      throw new ConvexError("Failed to send reset password email");
    }

    return { success: true };
  },
});
