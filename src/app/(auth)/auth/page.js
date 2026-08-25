import { Suspense } from "react";
import AuthLoginLoadingShell from "@/components/auth/AuthLoginLoadingShell";
import { createLegacyAuthRedirect } from "@/lib/auth-login-pages";

export const metadata = {
  description: "Sign in to your Citius Holidays account.",
  title: "Sign In",
};

export default function AuthPage({ searchParams }) {
  return (
    <Suspense fallback={<AuthLoginLoadingShell />}>
      <AuthRedirect searchParams={searchParams} />
    </Suspense>
  );
}

async function AuthRedirect({ searchParams }) {
  return createLegacyAuthRedirect({ searchParams });
}
