import { createAuthLoginPage } from "@/lib/auth-login-pages";
import { getAuthVariant } from "@/lib/auth-sign-in-targets";

const variant = getAuthVariant("vendor");

export const metadata = {
  title: variant.metadata.title,
  description: variant.metadata.description,
};

export default function VendorAuthPage({ searchParams }) {
  return createAuthLoginPage({ variantId: "vendor", searchParams });
}
