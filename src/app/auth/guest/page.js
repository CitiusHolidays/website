import { createAuthLoginPage } from "@/lib/auth-login-pages";
import { getAuthVariant } from "@/lib/auth-sign-in-targets";

const variant = getAuthVariant("guest");

export const metadata = {
  title: variant.metadata.title,
  description: variant.metadata.description,
};

export default function GuestAuthPage({ searchParams }) {
  return createAuthLoginPage({ variantId: "guest", searchParams });
}
