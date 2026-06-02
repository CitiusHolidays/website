import { anyApi } from "convex/server";
import { unstable_noStore } from "next/cache";
import { fetchAuthMutation, fetchAuthQuery, requireAuth } from "@/lib/auth-server";
import AccountClient from "./page.client.js";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "My Account | Citius Holidays",
  description: "Manage your bookings and profile settings.",
};

export default async function AccountPage() {
  // Prevent caching - auth state should be checked fresh each request
  unstable_noStore();

  // Use requireAuth to ensure user is authenticated
  // This will redirect to /auth if not logged in
  return requireAuth("/account").then(async ({ user }) => {
    const [, bookings] = await Promise.all([
      fetchAuthMutation(anyApi.userProfiles.ensureMyProfile, {}),
      fetchAuthQuery(anyApi.bookings.getMyBookings, {}),
    ]);

    return <AccountClient user={user} bookings={bookings} />;
  });
}
