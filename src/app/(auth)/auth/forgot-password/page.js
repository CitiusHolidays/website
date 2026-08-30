import { getAuthVariantFromCallbackUrl, resolveAuthReturnTarget } from "@/lib/auth-sign-in-targets";
import ForgotPasswordPageClient from "./page.client";

export const metadata = {
  description: "Request a secure password reset link for your Citius Holidays account.",
  title: "Forgot Password",
};

export default async function ForgotPasswordPage({ searchParams }) {
  const callbackUrl = (await searchParams)?.callbackUrl;
  const variant = getAuthVariantFromCallbackUrl(callbackUrl);
  const returnTo = resolveAuthReturnTarget(variant.id, callbackUrl);

  return <ForgotPasswordPageClient returnTo={returnTo} variantId={variant.id} />;
}
