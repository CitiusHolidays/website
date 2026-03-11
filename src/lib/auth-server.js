import { convexBetterAuthNextJs } from "@convex-dev/better-auth/nextjs";
import { fetchAction, fetchMutation, fetchQuery } from "convex/nextjs";
import { anyApi } from "convex/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

const convexUrl =
  process.env.NEXT_PUBLIC_CONVEX_URL ?? "http://127.0.0.1:3210";
const convexSiteUrl =
  process.env.NEXT_PUBLIC_CONVEX_SITE_URL ??
  process.env.NEXT_PUBLIC_CONVEX_URL ??
  "http://127.0.0.1:3211";

const betterAuth = convexBetterAuthNextJs({
  convexUrl,
  convexSiteUrl,
});

export const {
  handler,
  preloadAuthQuery,
} = betterAuth;

const inferProtocol = (host, forwardedProto) => {
  if (forwardedProto) {
    return forwardedProto;
  }
  if (!host) {
    return "https";
  }
  return host.includes("localhost") || host.startsWith("127.0.0.1")
    ? "http"
    : "https";
};

const getRequestToken = async () => {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = inferProtocol(
    host,
    requestHeaders.get("x-forwarded-proto"),
  );
  if (!host) {
    return null;
  }

  const tokenResponse = await fetch(`${protocol}://${host}/api/auth/convex/token`, {
    method: "GET",
    headers: {
      cookie: requestHeaders.get("cookie") ?? "",
      accept: "application/json",
    },
    cache: "no-store",
  }).catch(() => null);

  if (!tokenResponse?.ok) {
    return null;
  }

  const data = await tokenResponse.json().catch(() => null);
  return typeof data?.token === "string" && data.token.length > 0
    ? data.token
    : null;
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
  return { user, session: { user } };
}

const getLoginUrl = (callbackUrl) =>
  callbackUrl ? `/auth?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/auth";

export async function requireAuth(callbackUrl) {
  const loginUrl = getLoginUrl(callbackUrl);
  // Only redirect for true unauthenticated states.
  // Let other errors bubble so we don't trap users in a login loop.
  const user = await getServerUser();
  if (!user) {
    redirect(loginUrl);
  }

  return { user, session: { user } };
}

export async function requireGuest(redirectTo = "/") {
  // Try to get the user - if we succeed, they're authenticated so redirect
  try {
    const user = await getServerUser();
    if (user) {
      redirect(redirectTo);
    }
  } catch {
    // Not authenticated, which is what we want for requireGuest
  }
}

export async function getUserForLayout() {
  const user = await getServerUser();
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image,
  };
}




