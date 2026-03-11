import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth-server";
import AuthPageClient from "./page.client";

export const metadata = {
  title: 'Sign In',
  description: 'Sign in to your Citius Travel account to manage your bookings and explore spiritual trails.',
};

export default async function AuthPage({ searchParams }) {
  const params = await searchParams;
  const callbackUrl = params?.callbackUrl || "/";
  const user = await getServerUser().catch(() => null);

  if (user) {
    redirect(callbackUrl);
  }

  const error = params?.error;
  const mode = params?.mode || "signin";

  return <AuthPageClient initialMode={mode} callbackUrl={callbackUrl} error={error} />;
}




