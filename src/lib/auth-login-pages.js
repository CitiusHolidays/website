import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import AuthLoginLoadingShell from "@/components/auth/AuthLoginLoadingShell";
import AuthLoginPageClient from "@/components/auth/AuthLoginPageClient";
import { formatAuthCallbackError } from "@/lib/auth-errors";
import { getServerUser } from "@/lib/auth-server";
import {
  getAuthVariant,
  getLoginUrlForCallback,
  resolveAuthReturnTarget,
} from "@/lib/auth-sign-in-targets";

export function createAuthLoginPage({ variantId, searchParams }) {
  return (
    <Suspense fallback={<AuthLoginLoadingShell />}>
      <AuthLoginBoundary searchParams={searchParams} variantId={variantId} />
    </Suspense>
  );
}

async function AuthLoginBoundary({ variantId, searchParams }) {
  // Login pages read both callback parameters and the current session. Keep
  // that response at request time; the parent fallback contains no session,
  // callback, user, or destination-specific data.
  await connection();
  const params = await searchParams;
  const variant = getAuthVariant(variantId);
  const returnTo = resolveAuthReturnTarget(variant.id, params?.callbackUrl);
  // `getServerUser` returns null for a reviewed unauthenticated session. Do
  // not swallow token-exchange infrastructure failures as if the user logged
  // out; the route error boundary must offer a retry instead.
  const user = await getServerUser();

  if (user) {
    redirect(returnTo);
  }

  const error = formatAuthCallbackError(params?.error);
  const mode = params?.mode || "signin";

  return (
    <AuthLoginPageClient
      error={error}
      initialMode={mode}
      returnTo={returnTo}
      variantId={variantId}
    />
  );
}

export async function createLegacyAuthRedirect({ searchParams }) {
  const params = await searchParams;
  const callbackUrl = params?.callbackUrl;
  const authUrl = new URL(getLoginUrlForCallback(callbackUrl), "https://auth-login.invalid");

  if (params?.error) {
    authUrl.searchParams.set("error", params.error);
  }
  if (params?.mode) {
    authUrl.searchParams.set("mode", params.mode);
  }

  redirect(`${authUrl.pathname}${authUrl.search}`);
}
