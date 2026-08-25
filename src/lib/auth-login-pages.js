import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import AuthLoginLoadingShell from "@/components/auth/AuthLoginLoadingShell";
import AuthLoginPageClient from "@/components/auth/AuthLoginPageClient";
import { formatAuthCallbackError } from "@/lib/auth-errors";
import { getServerUser } from "@/lib/auth-server";
import { getAuthVariant, getAuthVariantFromCallbackUrl } from "@/lib/auth-sign-in-targets";

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
  // `getServerUser` returns null for a reviewed unauthenticated session. Do
  // not swallow token-exchange infrastructure failures as if the user logged
  // out; the route error boundary must offer a retry instead.
  const user = await getServerUser();

  if (user) {
    redirect(variant.href);
  }

  const error = formatAuthCallbackError(params?.error);
  const mode = params?.mode || "signin";

  return <AuthLoginPageClient error={error} initialMode={mode} variantId={variantId} />;
}

export async function createLegacyAuthRedirect({ searchParams }) {
  const params = await searchParams;
  const callbackUrl = params?.callbackUrl;
  const variant = getAuthVariantFromCallbackUrl(callbackUrl);
  const query = new URLSearchParams();

  if (params?.error) {
    query.set("error", params.error);
  }
  if (params?.mode) {
    query.set("mode", params.mode);
  }

  const suffix = query.toString() ? `?${query.toString()}` : "";
  redirect(`${variant.authPath}${suffix}`);
}
