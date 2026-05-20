import { createClient } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import {
  type GenericCtx,
  requireActionCtx,
} from "@convex-dev/better-auth/utils";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { api, components } from "../_generated/api";
import type { DataModel } from "../_generated/dataModel";
import authConfig from "../auth.config";
import schema from "./schema";

const THIRTY_DAYS_IN_SECONDS = 30 * 24 * 60 * 60;
const TWENTY_FOUR_HOURS_IN_SECONDS = 24 * 60 * 60;
const FIVE_MINUTES_IN_SECONDS = 5 * 60;

export const authComponent = createClient<DataModel, typeof schema>(
  components.betterAuth,
  {
    local: { schema },
    verbose: false,
  },
);

export const createAuthOptions = (ctx: GenericCtx<DataModel>) => {
  const baseURL =
    process.env.SITE_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";
  const secret = process.env.BETTER_AUTH_SECRET ?? "";
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const secureCookiesOverride = process.env.BETTER_AUTH_SECURE_COOKIES;
  const useSecureCookies =
    secureCookiesOverride === "true"
      ? true
      : secureCookiesOverride === "false"
        ? false
        : baseURL.startsWith("https://");

  // Only enable Google provider if credentials are configured
  const socialProviders: BetterAuthOptions["socialProviders"] = {};
  if (googleClientId && googleClientSecret) {
    socialProviders.google = {
      clientId: googleClientId,
      clientSecret: googleClientSecret,
      scope: ["email", "profile"],
    };
  }

  return {
    appName: "Citius Travel",
    baseURL,
    secret,
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      requireEmailVerification: true,
      sendResetPassword: async ({ user, url, token }) => {
        const resetUrl = token
          ? `${baseURL}/auth/reset-password?token=${token}`
          : url;
        const html = `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
            <h2 style="color: #0c1b33; margin-top: 0;">Reset Your Password</h2>
            <p>Hi ${user.name || "there"},</p>
            <p>We received a request to reset your password for your Citius Travel account. Please click the button below to choose a new password:</p>
            <p style="margin: 24px 0;">
              <a href="${resetUrl}" style="background-color: #0c1b33; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Reset Password</a>
            </p>
            <p style="color: #64748b; font-size: 14px;">If you did not request a password reset, you can safely ignore this email.</p>
          </div>
        `;
        try {
          await requireActionCtx(ctx).runAction(api.email.sendEmail, {
            to: user.email,
            subject: "Reset your Citius Travel password",
            html,
          });
        } catch (err) {
          console.error("Failed to send reset password email:", err);
        }
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      sendVerificationEmail: async ({ user, url, token }) => {
        const html = `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
            <h2 style="color: #0c1b33; margin-top: 0;">Verify Your Email Address</h2>
            <p>Hi ${user.name || "there"},</p>
            <p>Thank you for signing up with Citius Travel. Please click the button below to verify your email address:</p>
            <p style="margin: 24px 0;">
              <a href="${url}" style="background-color: #0c1b33; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Verify Email</a>
            </p>
            <p style="color: #64748b; font-size: 14px;">If you did not sign up for an account, you can safely ignore this email.</p>
          </div>
        `;
        try {
          await requireActionCtx(ctx).runAction(api.email.sendEmail, {
            to: user.email,
            subject: "Verify your Citius Travel account",
            html,
          });
        } catch (err) {
          console.error("Failed to send verification email:", err);
        }
      },
    },
    socialProviders,
    session: {
      expiresIn: THIRTY_DAYS_IN_SECONDS,
      updateAge: TWENTY_FOUR_HOURS_IN_SECONDS,
      cookieCache: {
        enabled: true,
        maxAge: FIVE_MINUTES_IN_SECONDS,
      },
    },
    user: {
      additionalFields: {
        phoneNumber: {
          type: "string",
          required: false,
        },
      },
    },
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: googleClientId ? ["google"] : [],
      },
    },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 10,
    },
    advanced: {
      // In Convex dev deployments NODE_ENV can still be "production".
      // Derive secure cookie behavior from URL/override so localhost auth works.
      useSecureCookies,
      // Use default cookie configuration - don't override cookiePrefix
    },
    plugins: [convex({ authConfig })],
  } satisfies BetterAuthOptions;
};

export const options = createAuthOptions({} as GenericCtx<DataModel>);

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth(createAuthOptions(ctx));
};
