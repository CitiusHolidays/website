import { createLegacyAuthRedirect } from "@/lib/auth-login-pages";

export const metadata = {
  title: "Sign In",
  description: "Sign in to your Citius Holidays account.",
};

export default function AuthPage({ searchParams }) {
  return createLegacyAuthRedirect({ searchParams });
}
