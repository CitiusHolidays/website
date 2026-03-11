import { createClient } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import type { GenericCtx } from "@convex-dev/better-auth/utils";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { components } from "../_generated/api";
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
      requireEmailVerification: false,
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
