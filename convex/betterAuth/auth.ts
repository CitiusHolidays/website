import { createClient } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import {
  type GenericCtx,
  requireActionCtx,
  requireRunMutationCtx,
} from "@convex-dev/better-auth/utils";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { api, components, internal } from "../_generated/api";
import type { DataModel } from "../_generated/dataModel";
import authConfig from "../auth.config";
import { buildAuthEmailHtml, AUTH_EMAIL_BRAND } from "../lib/authEmailHtml";
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
    appName: AUTH_EMAIL_BRAND,
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
        const html = buildAuthEmailHtml({
          greetingName: user.name || "there",
          headline: "Reset your password",
          bodyParagraphs: [
            `We received a request to reset your password for your ${AUTH_EMAIL_BRAND} account. Click the button below to choose a new password.`,
          ],
          ctaHref: resetUrl,
          ctaLabel: "Reset password",
          footerNote:
            "If you did not request a password reset, you can safely ignore this email.",
        });
        try {
          await requireActionCtx(ctx).runAction(api.email.sendEmail, {
            to: user.email,
            subject: `Reset your ${AUTH_EMAIL_BRAND} password`,
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
        const html = buildAuthEmailHtml({
          greetingName: user.name || "there",
          headline: "Verify your email",
          bodyParagraphs: [
            `Thank you for signing up with ${AUTH_EMAIL_BRAND}. Click the button below to verify your email address and activate your account.`,
          ],
          ctaHref: url,
          ctaLabel: "Verify email",
          footerNote:
            "If you did not sign up for an account, you can safely ignore this email.",
        });
        try {
          await requireActionCtx(ctx).runAction(api.email.sendEmail, {
            to: user.email,
            subject: `Verify your ${AUTH_EMAIL_BRAND} account`,
            html,
          });
        } catch (err) {
          console.error("Failed to send verification email:", err);
        }
      },
      afterEmailVerification: async (user) => {
        if (!user.email) {
          return;
        }
        try {
          await requireRunMutationCtx(ctx).scheduler.runAfter(
            0,
            internal.crm.staffAction.sendPasswordSetupAfterVerification,
            { email: user.email },
          );
        } catch (err) {
          console.error("Failed to queue staff password setup after verification:", err);
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
        allowDifferentEmails: false,
      },
    },
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            if (!user.email) {
              return;
            }
            try {
              await requireRunMutationCtx(ctx).scheduler.runAfter(
                0,
                internal.authSync.syncFromIdentity,
                {
                  authUserId: user.id,
                  email: user.email,
                  name: user.name,
                  image: user.image ?? undefined,
                },
              );
            } catch (err) {
              console.error("Failed to queue auth sync after user create:", err);
            }
          },
        },
      },
      session: {
        create: {
          after: async (session) => {
            try {
              const authUser = await authComponent.getAnyUserById(ctx, session.userId);
              if (!authUser?.email) {
                return;
              }
              await requireRunMutationCtx(ctx).scheduler.runAfter(
                0,
                internal.authSync.syncFromIdentity,
                {
                  authUserId: session.userId,
                  email: authUser.email,
                  name: authUser.name,
                  image: authUser.image ?? undefined,
                },
              );
            } catch (err) {
              console.error("Failed to queue auth sync after session create:", err);
            }
          },
        },
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
