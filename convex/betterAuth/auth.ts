import { expo } from "@better-auth/expo";
import { createClient } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import {
  type GenericCtx,
  requireActionCtx,
  requireRunMutationCtx,
} from "@convex-dev/better-auth/utils";
import { type BetterAuthOptions, betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { magicLink } from "better-auth/plugins/magic-link";
import { components, internal } from "../_generated/api";
import type { DataModel } from "../_generated/dataModel";
import authConfig from "../auth.config";
import { scheduleAppSignInLink } from "../customerAppSignInDelivery";
import {
  AUTH_EMAIL_TOKEN_TTL_SECONDS,
  type AuthEmailPurpose,
  authEmailCorrelationSecretFromUrl,
  deliverTransactionalAuthEmail,
  resolveAuthEmailControlKey,
} from "../lib/authEmailDelivery";
import { AUTH_EMAIL_BRAND, prepareAuthEmailMessage } from "../lib/authEmailHtml";
import { resolveAuthOrigin } from "../lib/authOriginPolicy";
import { SIGN_IN_DEVICE_HEADER, sha256Hex } from "../lib/customerAppSignIn";
import { NATIVE_APP_TRUSTED_ORIGINS } from "../lib/nativeAppOrigins";
import { isRuntimeString } from "../lib/runtimeValues";
import schema from "./schema";

const THIRTY_DAYS_IN_SECONDS = 30 * 24 * 60 * 60;
const TWENTY_FOUR_HOURS_IN_SECONDS = 24 * 60 * 60;
/** The customer app's email sign-in link works once, for this long (ADR 0020). */
export const APP_SIGN_IN_LINK_TTL_SECONDS = 10 * 60;

/**
 * The customer app's email sign-in link opens the website's `/app/sign-in` page, which hands the
 * token to the installed app in the URL fragment (never sent to a server). The app then calls
 * `/magic-link/verify` itself, so the session lands in the app's secure storage and no session
 * cookie ever travels in a URL.
 */
const TRAILING_SLASH = /\/$/;

export function appSignInLinkUrl(baseURL: string, token: string) {
  return `${baseURL.replace(TRAILING_SLASH, "")}/app/sign-in#token=${encodeURIComponent(token)}`;
}

export function reportAuthEmailFailure(outcome: {
  correlationDigest?: string;
  failureCode?: string;
  purpose: AuthEmailPurpose;
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
        // Link Google into an existing email/password account only after that account's email
        // is verified. Otherwise anyone could sign up with a victim's address and their own
        // password, wait for the victim's first Google sign-in to link and verify the row, and
        // then sign in with that password. Better Auth makes this gate unconditional next minor.
        requireLocalEmailVerified: true,
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
      // A reset is how someone takes an account back, so it signs out every existing session:
      // a stolen cookie or a session opened with the old password must not outlive it.
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url, token }) => {
        const resetUrl = token ? `${baseURL}/auth/reset-password?token=${token}` : url;
        try {
          const message = await prepareAuthEmailMessage({
            ctaHref: resetUrl,
            greetingName: user.name || "there",
            purpose: "password_reset",
          });
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
        try {
          const message = await prepareAuthEmailMessage({
            ctaHref: url,
            greetingName: user.name || "there",
            purpose: "verification",
          });
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
    hooks: {
      // A sign-in link opens a session only on the device that asked for it (ADR 0020).
      before: createAuthMiddleware(async (hookCtx) => {
        if (hookCtx.path !== "/magic-link/verify") {
          return;
        }
        const rawToken = hookCtx.query?.token;
        const token = isRuntimeString(rawToken) ? rawToken : "";
        const deviceSecret = hookCtx.headers?.get(SIGN_IN_DEVICE_HEADER) ?? "";
        const matches =
          token.length > 0 &&
          deviceSecret.length > 0 &&
          (await requireActionCtx(ctx).runMutation(internal.customerAppAuth.consumeSignInDevice, {
            deviceSecret,
            tokenDigest: await sha256Hex(token),
          }));
        if (!matches) {
          throw new APIError("UNAUTHORIZED", { code: "INVALID_TOKEN", message: "INVALID_TOKEN" });
        }
      }),
    },
    // expo() lets the installed apps exchange sessions through their URL schemes; the issuer and
    // Convex token path stay the same as the web, so identities match (ADR 0009).
    plugins: [
      expo(),
      convex({ authConfig }),
      magicLink({
        expiresIn: APP_SIGN_IN_LINK_TTL_SECONDS,
        // Answers at once, the same way whatever happens: the checks and the email run in the
        // background (customerAppSignInDelivery), so nothing is held open and the response time
        // reveals nothing about the address.
        sendMagicLink: async ({ email, metadata, token }) => {
          await scheduleAppSignInLink(requireActionCtx(ctx), secret, { email, metadata, token });
        },
        storeToken: "hashed",
      }),
    ],
    rateLimit: {
      enabled: true,
      max: 10,
      window: 60,
    },
    secret,
    session: {
      expiresIn: THIRTY_DAYS_IN_SECONDS,
      updateAge: TWENTY_FOUR_HOURS_IN_SECONDS,
    },
    socialProviders,
    trustedOrigins: [...NATIVE_APP_TRUSTED_ORIGINS],
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
