import { getAuthVariant } from "@/lib/auth-sign-in-targets";
import { createAuthLoginPage } from "@/lib/auth-login-pages";

const variant = getAuthVariant("employee");

export const metadata = {
  title: variant.metadata.title,
  description: variant.metadata.description,
};

export default function ConnectAuthPage({ searchParams }) {
  return createAuthLoginPage({ variantId: "employee", searchParams });
}
