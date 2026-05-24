import { createLegacyAuthRedirect } from "@/lib/auth-login-pages";

export default function AuthPage({ searchParams }) {
  return createLegacyAuthRedirect({ searchParams });
}
