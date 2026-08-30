import { getAuthVariantFromCallbackUrl, resolveAuthReturnTarget } from "@/lib/auth-sign-in-targets";
import ResetPasswordPageClient from "./page.client";

export const metadata = {
  description: "Set a new password for your Citius Holidays account.",
  title: "Reset Password",
};

export default async function ResetPasswordPage({ searchParams }) {
  const callbackUrl = (await searchParams)?.callbackUrl;
  const variant = getAuthVariantFromCallbackUrl(callbackUrl);
  const returnTo = resolveAuthReturnTarget(variant.id, callbackUrl);

  return <ResetPasswordPageClient returnTo={returnTo} variantId={variant.id} />;
}
