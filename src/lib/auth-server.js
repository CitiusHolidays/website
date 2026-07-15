import { convexBetterAuthNextJs } from "@convex-dev/better-auth/nextjs";
import { fetchAction, fetchMutation, fetchQuery } from "convex/nextjs";
import { anyApi } from "convex/server";
import { headers } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { getLoginUrlForCallback } from "@/lib/auth-sign-in-targets";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL ?? "http://127.0.0.1:3210";
const convexSiteUrl =
  process.env.NEXT_PUBLIC_CONVEX_SITE_URL ??
  process.env.NEXT_PUBLIC_CONVEX_URL ??
  "http://127.0.0.1:3211";

const betterAuth = convexBetterAuthNextJs({
  convexSiteUrl,
  convexUrl,
});

export const { handler, preloadAuthQuery } = betterAuth;

export function resolveTrustedAppOrigin(env = process.env) {
  const configuredUrl = env.BETTER_AUTH_URL ?? env.SITE_URL ?? env.NEXT_PUBLIC_APP_URL;
  if (!configuredUrl) {
    if (env.NODE_ENV === "production") {
      throw new Error("Configure a trusted application origin for server authentication");
    }
    return "http://localhost:3000";
  }
  let parsed;
  try {
    parsed = new URL(configuredUrl);
  } catch (cause) {
    throw new Error("Configure a valid trusted application origin for server authentication", {
      cause,
    });
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Configure an HTTP(S) trusted application origin for server authentication");
  }
  return parsed.origin;
}

function authenticationCookieHeader(cookieHeader) {
  return String(cookieHeader ?? "")
    .split(";")
    .map((part) => part.trim())
    .filter((part) => {
      const [name] = part.split("=", 1);
      return (
        name.startsWith("better-auth.") ||
        name.startsWith("__Secure-better-auth.") ||
        name.startsWith("__Host-better-auth.")
      );
    })
    .join("; ");
}

export async function fetchConvexTokenFromHeaders(
  requestHeaders,
  { fetchImpl = fetch, trustedOrigin = resolveTrustedAppOrigin() } = {}
) {
  const tokenResponse = await fetchImpl(`${trustedOrigin}/api/auth/convex/token`, {
    cache: "no-store",
    headers: {
      accept: "application/json",
      cookie: authenticationCookieHeader(requestHeaders.get("cookie")),
    },
    method: "GET",
  }).catch(() => null);

  if (!tokenResponse?.ok) {
    return null;
  }

  const data = await tokenResponse.json().catch(() => null);
  return typeof data?.token === "string" && data.token.length > 0 ? data.token : null;
}

const getRequestToken = async () => {
  const requestHeaders = await headers();
  return await fetchConvexTokenFromHeaders(requestHeaders);
};

export async function getToken() {
  return await getRequestToken();
}

export async function isAuthenticated() {
  return !!(await getRequestToken());
}

export async function fetchAuthQuery(query, args = {}) {
  const token = await getRequestToken();
  return await fetchQuery(query, args, {
    token: token ?? undefined,
    url: convexUrl,
  });
}

export async function fetchAuthMutation(mutation, args = {}) {
  const token = await getRequestToken();
  return await fetchMutation(mutation, args, {
    token: token ?? undefined,
    url: convexUrl,
  });
}

export async function fetchAuthAction(action, args = {}) {
  const token = await getRequestToken();
  return await fetchAction(action, args, {
    token: token ?? undefined,
    url: convexUrl,
  });
}

export async function getServerUser() {
  return await fetchAuthQuery(anyApi.auth.getCurrentUser, {});
}

export async function getServerSession() {
  const user = await getServerUser();
  if (!user) {
    return null;
  }
  return { session: { user }, user };
}

const getLoginUrl = (callbackUrl) => getLoginUrlForCallback(callbackUrl || "/account");

export async function requireAuth(callbackUrl) {
  const loginUrl = getLoginUrl(callbackUrl);
  // Only redirect for true unauthenticated states.
  // Let other errors bubble so we don't trap users in a login loop.
  const user = await getServerUser();
  if (!user) {
    redirect(loginUrl);
  }

  return { session: { user }, user };
}

export async function requireGuest(redirectTo = "/") {
  // Try to get the user - if we succeed, they're authenticated so redirect
  let user = null;
  try {
    user = await getServerUser();
  } catch (error) {
    unstable_rethrow(error);
    // Not authenticated, which is what we want for requireGuest
  }
  if (user) {
    redirect(redirectTo);
  }
}

export async function getUserForLayout() {
  const user = await getServerUser();
  if (!user) {
    return null;
  }

  return {
    email: user.email,
    id: user.id,
    image: user.image,
    name: user.name,
  };
}
