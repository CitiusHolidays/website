"use client";

import { getAuthVariant } from "@/lib/auth-sign-in-targets";
import citiusConnectLogo from "@/static/logos/citiusconnect.png";
import citiusLogo from "@/static/logos/logo.webp";
import { AuthLoginCredentials } from "./AuthLoginCredentials";
import { AuthLoginHero } from "./AuthLoginHero";

export default function AuthLoginPageClient({
  variantId = "guest",
  initialMode = "signin",
  error,
}) {
  const variant = getAuthVariant(variantId);
  const copy = variant.copy;
  const isConnect = variantId === "employee";
  const brandLogo = isConnect ? citiusConnectLogo : citiusLogo;
  const brandLogoAlt = isConnect ? "Citius Connect" : "Citius Holidays";

  return (
    <div className="flex min-h-screen w-full flex-col bg-[#FDFBF7] md:flex-row">
      <AuthLoginHero
        brandLogo={brandLogo}
        brandLogoAlt={brandLogoAlt}
        copy={copy}
        isConnect={isConnect}
      />
      <AuthLoginCredentials
        brandLogo={brandLogo}
        brandLogoAlt={brandLogoAlt}
        copy={copy}
        error={error}
        initialMode={initialMode}
        isConnect={isConnect}
        variant={variant}
      />
    </div>
  );
}
