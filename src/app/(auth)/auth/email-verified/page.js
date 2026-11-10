import { redirect } from "next/navigation";
import { Suspense } from "react";
import AuthShell from "@/components/auth/AuthShell";
import { travellerDestination } from "@/lib/auth-sign-in-targets";
import EmailVerifiedPageClient from "./page.client";

export const metadata = {
  description: "Your Citius Holidays email address has been verified.",
  title: "Email Verified",
};

// Reading `searchParams` is request data, so it must sit inside Suspense for the route to prerender.
async function EmailVerifiedRoute({ searchParams }) {
  const destination = travellerDestination((await searchParams) ?? {});
  if (destination) {
    redirect(destination);
  }
  return <EmailVerifiedPageClient />;
}

export default function EmailVerifiedPage({ searchParams }) {
  return (
    <Suspense fallback={<AuthShell title="Checking your link" />}>
      <EmailVerifiedRoute searchParams={searchParams} />
    </Suspense>
  );
}
