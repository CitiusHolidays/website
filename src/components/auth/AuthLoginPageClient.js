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
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-[#FDFBF7]">
      <AuthLoginHero
        copy={copy}
        brandLogo={brandLogo}
        brandLogoAlt={brandLogoAlt}
        isConnect={isConnect}
      />
      <AuthLoginCredentials
        variant={variant}
        copy={copy}
        brandLogo={brandLogo}
        brandLogoAlt={brandLogoAlt}
        isConnect={isConnect}
        initialMode={initialMode}
        error={error}
      />
    </div>
  );
}
