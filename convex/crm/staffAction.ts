"use node";

import { v } from "convex/values";
import { internalAction, action } from "../_generated/server";
import { api, internal } from "../_generated/api";
import { ConvexError } from "convex/values";
import { createAuth } from "../betterAuth/auth";
import crypto from "crypto";

export const provisionStaffUser = internalAction({
  args: {
    staffId: v.id("staffUsers"),
    email: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = createAuth(ctx);
    const tempPassword = crypto.randomUUID() + "A1!";

    try {
      // 1. Pre-create user in Better Auth
      const result = await auth.api.signUpEmail({
        body: {
          email: args.email,
          password: tempPassword,
          name: args.name,
        },
      });

      if (!result || !result.user) {
        throw new Error("Failed to create Better Auth user");
      }

      const authUserId = result.user.id;

      // 2. Link the authUserId to our staffUsers row
      await ctx.runMutation(internal.crm.staff.linkAuthUserId, {
        staffId: args.staffId,
        authUserId,
      });

      // 3. Send password setup email via Better Auth reset flow
      const siteUrl =
        process.env.SITE_URL ||
        process.env.NEXT_PUBLIC_SITE_URL ||
        "http://localhost:3000";
      await auth.api.requestPasswordReset({
        body: {
          email: args.email,
          redirectTo: `${siteUrl}/auth/reset-password`,
        },
      });
    } catch (err: any) {
      console.error("Staff provision error:", err);
    }
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
    const siteUrl =
      process.env.SITE_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "http://localhost:3000";
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
