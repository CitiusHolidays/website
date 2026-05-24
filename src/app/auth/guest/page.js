import { getAuthVariant } from "@/lib/auth-sign-in-targets";
import { createAuthLoginPage } from "@/lib/auth-login-pages";

const variant = getAuthVariant("guest");

export const metadata = {
  title: variant.metadata.title,
  description: variant.metadata.description,
};

export default function GuestAuthPage({ searchParams }) {
  return createAuthLoginPage({ variantId: "guest", searchParams });
}
