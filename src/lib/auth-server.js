import { randomUUID } from "node:crypto";
import { convexBetterAuthNextJs } from "@convex-dev/better-auth/nextjs";
import { fetchAction, fetchMutation, fetchQuery } from "convex/nextjs";
import { anyApi } from "convex/server";
import { headers } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { getLoginUrlForCallback } from "@/lib/auth-sign-in-targets";

export const AUTH_TOKEN_EXCHANGE_KINDS = Object.freeze({
  CONFIGURATION: "configuration",
  MALFORMED: "malformed",
  TRANSIENT: "transient",
});

const RETRYABLE_TOKEN_EXCHANGE_KINDS = new Set([
  AUTH_TOKEN_EXCHANGE_KINDS.MALFORMED,
  AUTH_TOKEN_EXCHANGE_KINDS.TRANSIENT,
]);

/**
 * A failure while exchanging the Better Auth session cookie for a Convex JWT.
 *
 * This error intentionally contains only a short, user-safe message and a
 * correlation id. It never carries the request cookie or the exchanged JWT.
 */
export class AuthTokenExchangeError extends Error {
  constructor(kind, message, { cause, correlationId = randomUUID(), status } = {}) {
    const safeCorrelationId = String(correlationId || randomUUID());
    super(`${message} Reference: ${safeCorrelationId}.`, { cause });
    this.name = "AuthTokenExchangeError";
    this.code = `AUTH_TOKEN_EXCHANGE_${String(kind).toUpperCase()}`;
    this.correlationId = safeCorrelationId;
    this.kind = kind;
    this.retryable = RETRYABLE_TOKEN_EXCHANGE_KINDS.has(kind);
    if (status !== undefined) {
      this.status = status;
    }
  }
}

export function isAuthTokenExchangeError(error) {
  return error instanceof AuthTokenExchangeError;
}

export function isRetryableAuthTokenExchangeError(error) {
  return isAuthTokenExchangeError(error) && error.retryable === true;
}

function tokenExchangeError(kind, message, options) {
  return new AuthTokenExchangeError(kind, message, options);
}

function configurationError(message, options) {
  return tokenExchangeError(AUTH_TOKEN_EXCHANGE_KINDS.CONFIGURATION, message, options);
}

function malformedResponseError(options) {
  return tokenExchangeError(
    AUTH_TOKEN_EXCHANGE_KINDS.MALFORMED,
    "The authentication service returned an invalid session response. Try again.",
    options
  );
}

function transientError(options) {
  return tokenExchangeError(
    AUTH_TOKEN_EXCHANGE_KINDS.TRANSIENT,
    "The authentication service is temporarily unavailable. Try again.",
    options
  );
}

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
      throw configurationError("Configure a trusted application origin for server authentication");
    }
    return "http://localhost:3000";
  }
  let parsed;
  try {
    parsed = new URL(configuredUrl);
  } catch (cause) {
    throw configurationError(
      "Configure a valid trusted application origin for server authentication",
      {
        cause,
      }
    );
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw configurationError(
      "Configure an HTTP(S) trusted application origin for server authentication"
    );
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

function tokenRequestOptions(requestCookie, timeoutMs) {
  return {
    cache: "no-store",
    headers: {
      accept: "application/json",
      cookie: requestCookie,
    },
    method: "GET",
    ...(timeoutMs > 0 &&
    typeof AbortSignal !== "undefined" &&
    typeof AbortSignal.timeout === "function"
      ? { signal: AbortSignal.timeout(timeoutMs) }
      : {}),
  };
}

function isRetryableTokenResponse(status) {
  return status === 408 || status === 429 || status >= 500;
}

function isUnauthenticatedTokenResponse(status) {
  return status === 401 || status === 403;
}

function validConvexToken(data) {
  const token = data?.token;
  return typeof token === "string" && token.length > 0 && token.trim() === token;
}

async function exchangeConvexToken({
  attempt,
  attempts,
  correlationId,
  fetchImpl,
  requestCookie,
  timeoutMs,
  tokenUrl,
}) {
  let tokenResponse;
  try {
    tokenResponse = await fetchImpl(tokenUrl, tokenRequestOptions(requestCookie, timeoutMs));
  } catch (cause) {
    if (attempt < attempts) {
      return exchangeConvexToken({
        attempt: attempt + 1,
        attempts,
        correlationId,
        fetchImpl,
        requestCookie,
        timeoutMs,
        tokenUrl,
      });
    }
    throw transientError({ cause, correlationId });
  }

  // Better Auth's session middleware uses 401/403 for a missing or expired
  // session. Only those reviewed absence states may become `null`; every
  // other failure must stay visible to the caller instead of redirecting to
  // sign-in and creating a misleading login loop.
  if (isUnauthenticatedTokenResponse(tokenResponse.status)) {
    return null;
  }

  if (isRetryableTokenResponse(tokenResponse.status)) {
    if (attempt < attempts) {
      return exchangeConvexToken({
        attempt: attempt + 1,
        attempts,
        correlationId,
        fetchImpl,
        requestCookie,
        timeoutMs,
        tokenUrl,
      });
    }
    throw transientError({ correlationId, status: tokenResponse.status });
  }

  if (!tokenResponse.ok) {
    throw configurationError("The authentication service is not configured correctly.", {
      correlationId,
      status: tokenResponse.status,
    });
  }

  let data;
  try {
    data = await tokenResponse.json();
  } catch (cause) {
    if (attempt < attempts) {
      return exchangeConvexToken({
        attempt: attempt + 1,
        attempts,
        correlationId,
        fetchImpl,
        requestCookie,
        timeoutMs,
        tokenUrl,
      });
    }
    throw malformedResponseError({ cause, correlationId, status: tokenResponse.status });
  }

  if (validConvexToken(data)) {
    return data.token;
  }
  if (attempt < attempts) {
    return exchangeConvexToken({
      attempt: attempt + 1,
      attempts,
      correlationId,
      fetchImpl,
      requestCookie,
      timeoutMs,
      tokenUrl,
    });
  }
  throw malformedResponseError({ correlationId, status: tokenResponse.status });
}

export async function fetchConvexTokenFromHeaders(
  requestHeaders,
  {
    correlationId = randomUUID(),
    fetchImpl = fetch,
    maxAttempts = 2,
    timeoutMs = 5000,
    trustedOrigin,
  } = {}
) {
  if (typeof fetchImpl !== "function") {
    throw configurationError("Configure a valid authentication token transport", {
      correlationId,
    });
  }

  let parsedOrigin;
  try {
    parsedOrigin = new URL(trustedOrigin ?? resolveTrustedAppOrigin());
  } catch (cause) {
    throw configurationError(
      "Configure a valid trusted application origin for server authentication",
      {
        cause,
        correlationId,
      }
    );
  }
  if (parsedOrigin.protocol !== "http:" && parsedOrigin.protocol !== "https:") {
    throw configurationError(
      "Configure an HTTP(S) trusted application origin for server authentication",
      { correlationId }
    );
  }

  const attempts = Math.min(
    3,
    Math.max(1, Number.isFinite(Number(maxAttempts)) ? Number(maxAttempts) : 2)
  );
  const requestCookie = authenticationCookieHeader(requestHeaders.get("cookie"));
  const tokenUrl = `${parsedOrigin.origin}/api/auth/convex/token`;

  return exchangeConvexToken({
    attempt: 1,
    attempts,
    correlationId,
    fetchImpl,
    requestCookie,
    timeoutMs,
    tokenUrl,
  });
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

async function resolveRequestToken(options) {
  return options && Object.hasOwn(options, "token") ? options.token : await getRequestToken();
}

export async function fetchAuthQuery(query, args = {}, options) {
  const token = await resolveRequestToken(options);
  return await fetchQuery(query, args, {
    token: token ?? undefined,
    url: convexUrl,
  });
}

export async function fetchAuthMutation(mutation, args = {}, options) {
  const token = await resolveRequestToken(options);
  return await fetchMutation(mutation, args, {
    token: token ?? undefined,
    url: convexUrl,
  });
}

export async function fetchAuthAction(action, args = {}, options) {
  const token = await resolveRequestToken(options);
  return await fetchAction(action, args, {
    token: token ?? undefined,
    url: convexUrl,
  });
}

export async function getServerUser(options) {
  return await fetchAuthQuery(anyApi.auth.getCurrentUser, {}, options);
}

export async function getServerSession() {
  const user = await getServerUser();
  if (!user) {
    return null;
  }
  return { session: { user }, user };
}

const getLoginUrl = (callbackUrl) => getLoginUrlForCallback(callbackUrl || "/account");

export async function requireAuth(callbackUrl, options) {
  const loginUrl = getLoginUrl(callbackUrl);
  // Only redirect for true unauthenticated states.
  // Let other errors bubble so we don't trap users in a login loop.
  const user = await getServerUser(options);
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
    if (isAuthTokenExchangeError(error)) {
      throw error;
    }
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
