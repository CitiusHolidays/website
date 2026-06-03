"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { createAuth } from "./betterAuth/auth";
import { sendPasswordSetupEmail, sendVerificationEmail } from "./lib/betterAuthEmail";
import {
  authAccountSummary,
  findAuthAccountsByUserId,
  findAuthUserByEmail,
} from "./lib/betterAuthLookup";

/**
 * When sign-up is attempted for an email that already has an auth user (Better Auth
 * returns a generic success to prevent enumeration), send the right recovery email:
 * verification for unverified credential users, password reset to add/link email login.
 */
export const handleExistingSignUpEmail = internalAction({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const authUser = await findAuthUserByEmail(ctx, args.email);
    if (!authUser?._id) {
      return { sent: false, reason: "user_not_found" as const };
    }

    const accounts = await findAuthAccountsByUserId(ctx, String(authUser._id));
    const { hasCredential, hasGoogle } = authAccountSummary(accounts);
    const auth = createAuth(ctx);

    if (hasCredential && !authUser.emailVerified) {
      const verification = await sendVerificationEmail(auth, args.email);
      return {
        sent: verification.sent,
        reason: verification.sent ? ("verification" as const) : verification.reason,
      };
    }

    if (!hasCredential && hasGoogle) {
      const sent = await sendPasswordSetupEmail(auth, args.email);
      return {
        sent,
        reason: sent ? ("password_setup" as const) : ("email_send_failed" as const),
      };
    }

    const passwordSent = await sendPasswordSetupEmail(auth, args.email);
    return {
      sent: passwordSent,
      reason: passwordSent ? ("password_reset" as const) : ("email_send_failed" as const),
    };
  },
});
