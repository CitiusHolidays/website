import { getAuthVariant } from "@/lib/auth-sign-in-targets";
import { createAuthLoginPage } from "@/lib/auth-login-pages";

const variant = getAuthVariant("vendor");

export const metadata = {
  title: variant.metadata.title,
  description: variant.metadata.description,
};

export default function VendorAuthPage({ searchParams }) {
  return createAuthLoginPage({ variantId: "vendor", searchParams });
}
