import { createClient } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import {
  type GenericCtx,
  requireActionCtx,
  requireRunMutationCtx,
} from "@convex-dev/better-auth/utils";
import { type BetterAuthOptions, betterAuth } from "better-auth";
import { components, internal } from "../_generated/api";
import type { DataModel } from "../_generated/dataModel";
import authConfig from "../auth.config";
import {
  AUTH_EMAIL_TOKEN_TTL_SECONDS,
  authEmailCorrelationSecretFromUrl,
  deliverTransactionalAuthEmail,
  resolveAuthEmailControlKey,
} from "../lib/authEmailDelivery";
import { AUTH_EMAIL_BRAND, prepareAuthEmailMessage } from "../lib/authEmailHtml";
import { resolveAuthOrigin } from "../lib/authOriginPolicy";
import schema from "./schema";

const THIRTY_DAYS_IN_SECONDS = 30 * 24 * 60 * 60;
const TWENTY_FOUR_HOURS_IN_SECONDS = 24 * 60 * 60;
const FIVE_MINUTES_IN_SECONDS = 5 * 60;

function reportAuthEmailFailure(outcome: {
  correlationDigest?: string;
  failureCode?: string;
  purpose: "password_reset" | "verification";
  status?: string;
}) {
  console.error(
    JSON.stringify({
      correlationDigest: outcome.correlationDigest,
      event: "auth_email_delivery_failed",
      failureCode: outcome.failureCode ?? "delivery_unavailable",
      purpose: outcome.purpose,
      status: outcome.status ?? "unknown",
    })
  );
}

export const authComponent = createClient<DataModel, typeof schema>(components.betterAuth, {
  local: { schema },
  verbose: false,
});

export const createAuthOptions = (ctx: GenericCtx<DataModel>) => {
  const baseURL = resolveAuthOrigin(process.env);
  const secret = process.env.BETTER_AUTH_SECRET ?? "";
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const secureCookiesOverride = process.env.BETTER_AUTH_SECURE_COOKIES;
  let useSecureCookies = baseURL.startsWith("https://");
  if (secureCookiesOverride === "true") {
    useSecureCookies = true;
  } else if (secureCookiesOverride === "false") {
    useSecureCookies = false;
  }

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
    account: {
      accountLinking: {
        allowDifferentEmails: false,
        enabled: true,
        // Google is trusted; allow linking even when the email/password account is not verified yet.
        requireLocalEmailVerified: false,
        trustedProviders: googleClientId ? ["google"] : [],
        updateUserInfoOnLink: true,
      },
    },
    advanced: {
      // In Convex dev deployments NODE_ENV can still be "production".
      // Derive secure cookie behavior from URL/override so localhost auth works.
      useSecureCookies,
      // Use default cookie configuration - don't override cookiePrefix
    },
    appName: AUTH_EMAIL_BRAND,
    baseURL,
    database: authComponent.adapter(ctx),
    databaseHooks: {
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
                  image: authUser.image ?? undefined,
                  name: authUser.name,
                }
              );
            } catch (err) {
              console.error("Failed to queue auth sync after session create:", err);
            }
          },
        },
      },
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
                  image: user.image ?? undefined,
                  name: user.name,
                }
              );
            } catch (err) {
              console.error("Failed to queue auth sync after user create:", err);
            }
          },
        },
      },
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      onExistingUserSignUp: async ({ user }) => {
        if (!user.email) {
          return;
        }
        try {
          await requireRunMutationCtx(ctx).scheduler.runAfter(
            0,
            internal.authAccountLinking.handleExistingSignUpEmail,
            { email: user.email }
          );
        } catch {
          console.error(JSON.stringify({ event: "existing_user_recovery_queue_failed" }));
        }
      },
      requireEmailVerification: true,
      resetPasswordTokenExpiresIn: AUTH_EMAIL_TOKEN_TTL_SECONDS,
      sendResetPassword: async ({ user, url, token }) => {
        const resetUrl = token ? `${baseURL}/auth/reset-password?token=${token}` : url;
        const message = prepareAuthEmailMessage({
          ctaHref: resetUrl,
          greetingName: user.name || "there",
          purpose: "password_reset",
        });
        try {
          const outcome = await deliverTransactionalAuthEmail(requireActionCtx(ctx), {
            controlKey: await resolveAuthEmailControlKey(
              requireActionCtx(ctx),
              url,
              token,
              "password_reset",
              user.email
            ),
            correlationSecret: authEmailCorrelationSecretFromUrl(url, token),
            expiresAt: Date.now() + AUTH_EMAIL_TOKEN_TTL_SECONDS * 1000,
            html: message.html,
            purpose: "password_reset",
            recipient: user.email,
            subject: message.subject,
            text: message.text,
          });
          if (outcome.status !== "sent") {
            reportAuthEmailFailure(outcome);
          }
        } catch {
          reportAuthEmailFailure({ purpose: "password_reset" });
        }
      },
    },
    emailVerification: {
      afterEmailVerification: async (user) => {
        if (!user.email) {
          return;
        }
        try {
          await requireRunMutationCtx(ctx).scheduler.runAfter(
            0,
            internal.crm.staffAction.sendPasswordSetupAfterVerification,
            { email: user.email }
          );
        } catch {
          console.error(JSON.stringify({ event: "staff_password_setup_queue_failed" }));
        }
      },
      expiresIn: AUTH_EMAIL_TOKEN_TTL_SECONDS,
      sendOnSignIn: true,
      sendOnSignUp: true,
      sendVerificationEmail: async ({ user, url, token }) => {
        const message = prepareAuthEmailMessage({
          ctaHref: url,
          greetingName: user.name || "there",
          purpose: "verification",
        });
        try {
          const outcome = await deliverTransactionalAuthEmail(requireActionCtx(ctx), {
            controlKey: await resolveAuthEmailControlKey(
              requireActionCtx(ctx),
              url,
              token,
              "verification",
              user.email
            ),
            correlationSecret: authEmailCorrelationSecretFromUrl(url, token),
            expiresAt: Date.now() + AUTH_EMAIL_TOKEN_TTL_SECONDS * 1000,
            html: message.html,
            purpose: "verification",
            recipient: user.email,
            subject: message.subject,
            text: message.text,
          });
          if (outcome.status !== "sent") {
            reportAuthEmailFailure(outcome);
          }
        } catch {
          reportAuthEmailFailure({ purpose: "verification" });
        }
      },
    },
    plugins: [convex({ authConfig })],
    rateLimit: {
      enabled: true,
      max: 10,
      window: 60,
    },
    secret,
    session: {
      cookieCache: {
        enabled: true,
        maxAge: FIVE_MINUTES_IN_SECONDS,
      },
      expiresIn: THIRTY_DAYS_IN_SECONDS,
      updateAge: TWENTY_FOUR_HOURS_IN_SECONDS,
    },
    socialProviders,
    user: {
      additionalFields: {
        phoneNumber: {
          required: false,
          type: "string",
        },
      },
    },
  } satisfies BetterAuthOptions;
};

// SAFETY: Better Auth inspects configuration without using a runtime Convex context at module initialization.
const configurationContext = {} as GenericCtx<DataModel>;

export const options = createAuthOptions(configurationContext);

export const createAuth = (ctx: GenericCtx<DataModel>) => betterAuth(createAuthOptions(ctx));
