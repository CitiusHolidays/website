import { redirect } from "next/navigation";
import { travellerDestination } from "@/lib/auth-sign-in-targets";
import EmailVerifiedPageClient from "./page.client";

export const metadata = {
  description: "Your Citius Holidays email address has been verified.",
  title: "Email Verified",
};

export default async function EmailVerifiedPage({ searchParams }) {
  const destination = travellerDestination((await searchParams) ?? {});
  if (destination) {
    redirect(destination);
  }
  return <EmailVerifiedPageClient />;
}
