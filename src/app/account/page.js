import { redirect } from "next/navigation";
import { unstable_noStore } from "next/cache";
import { anyApi } from "convex/server";
import {
  fetchAuthMutation,
  fetchAuthQuery,
  requireAuth,
} from "@/lib/auth-server";
import AccountClient from "./page.client.js";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "My Account | Citius Travel",
  description: "Manage your bookings and profile settings.",
};

export default async function AccountPage() {
  // Prevent caching - auth state should be checked fresh each request
  unstable_noStore();

  // Use requireAuth to ensure user is authenticated
  // This will redirect to /auth if not logged in
  const { user } = await requireAuth("/account");

  // Ensure profile exists in Convex
  await fetchAuthMutation(anyApi.userProfiles.ensureMyProfile, {});

  // Fetch bookings
  const bookings = await fetchAuthQuery(anyApi.bookings.getMyBookings, {});

  return <AccountClient user={user} bookings={bookings} />;
}




