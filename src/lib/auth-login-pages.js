import { redirect } from "next/navigation";
import AuthLoginPageClient from "@/components/auth/AuthLoginPageClient";
import { formatAuthCallbackError } from "@/lib/auth-errors";
import { getServerUser } from "@/lib/auth-server";
import { getAuthVariant, getAuthVariantFromCallbackUrl } from "@/lib/auth-sign-in-targets";

export async function createAuthLoginPage({ variantId, searchParams }) {
  const params = await searchParams;
  const variant = getAuthVariant(variantId);
  const user = await getServerUser().catch(() => null);

  if (user) {
    redirect(variant.href);
  }

  const error = formatAuthCallbackError(params?.error);
  const mode = params?.mode || "signin";

  return <AuthLoginPageClient variantId={variantId} initialMode={mode} error={error} />;
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
