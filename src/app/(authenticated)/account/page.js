import { anyApi } from "convex/server";
import { unstable_noStore } from "next/cache";
import { fetchAuthMutation, fetchAuthQuery, requireAuth } from "@/lib/auth-server";
import AccountClient from "./page.client.js";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export const metadata = {
  description: "Manage your bookings and profile settings.",
  title: "My Account | Citius Holidays",
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

    return <AccountClient bookings={bookings} user={user} />;
  });
}
