import { Suspense } from "react";
import { createLegacyAuthRedirect } from "@/lib/auth-login-pages";

export const metadata = {
  description: "Sign in to your Citius Holidays account.",
  title: "Sign In",
};

export default function AuthPage({ searchParams }) {
  return (
    <Suspense fallback={null}>
      <AuthRedirect searchParams={searchParams} />
    </Suspense>
  );
}

async function AuthRedirect({ searchParams }) {
  return createLegacyAuthRedirect({ searchParams });
}
