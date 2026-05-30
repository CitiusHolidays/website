import { createAuthLoginPage } from "@/lib/auth-login-pages";
import { getAuthVariant } from "@/lib/auth-sign-in-targets";

const variant = getAuthVariant("employee");

export const metadata = {
  title: variant.metadata.title,
  description: variant.metadata.description,
};

export default function ConnectAuthPage({ searchParams }) {
  return createAuthLoginPage({ variantId: "employee", searchParams });
}
