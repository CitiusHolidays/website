"use client";

import { getAuthVariant } from "@/lib/auth-sign-in-targets";
import citiusConnectLogo from "@/static/logos/citiusconnect.png";
import citiusLogo from "@/static/logos/logo.webp";
import { AuthLoginCredentials } from "./AuthLoginCredentials";

export default function AuthLoginPageClient({
  variantId = "guest",
  initialMode = "signin",
  error,
}) {
  const variant = getAuthVariant(variantId);
  const { copy } = variant;
  const isConnect = variantId === "employee";
  const brandLogo = isConnect ? citiusConnectLogo : citiusLogo;
  const brandLogoAlt = isConnect ? "Citius Connect" : "Citius Holidays";

  return (
    <AuthLoginCredentials
      brandLogo={brandLogo}
      brandLogoAlt={brandLogoAlt}
      copy={copy}
      error={error}
      initialMode={initialMode}
      variant={variant}
    />
  );
}
