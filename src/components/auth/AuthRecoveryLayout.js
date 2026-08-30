import { getAuthVariant } from "@/lib/auth-sign-in-targets";
import citiusConnectLogo from "@/static/logos/citiusconnect.png";
import citiusLogo from "@/static/logos/logo.webp";
import AuthShell from "./AuthShell";

export default function AuthRecoveryLayout({
  formTitle,
  formDescription,
  children,
  variantId = "guest",
}) {
  const variant = getAuthVariant(variantId);
  const isConnect = variant.id === "employee";

  return (
    <AuthShell
      description={formDescription}
      logo={isConnect ? citiusConnectLogo : citiusLogo}
      logoAlt={isConnect ? "Citius Connect" : "Citius Holidays"}
      title={formTitle}
    >
      {children}
    </AuthShell>
  );
}
