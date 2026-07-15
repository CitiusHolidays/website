import { createAuthLoginPage } from "@/lib/auth-login-pages";
import { getAuthVariant } from "@/lib/auth-sign-in-targets";

const variant = getAuthVariant("vendor");

export const metadata = {
  description: variant.metadata.description,
  title: variant.metadata.title,
};

// This request-sensitive boundary reads callback parameters and the current auth session.
export const instant = false;

export default function VendorAuthPage({ searchParams }) {
  return createAuthLoginPage({ searchParams, variantId: "vendor" });
}
