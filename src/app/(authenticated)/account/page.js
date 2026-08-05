import { anyApi } from "convex/server";
import { fetchAuthMutation, fetchAuthQuery, requireAuth } from "@/lib/auth-server";
import AccountClient from "./page.client.js";

// Account data is identity-scoped and must be resolved from request headers on every request.
export const instant = false;

export const metadata = {
  description: "Manage your bookings and profile settings.",
  title: "My Account | Citius Holidays",
};

export default async function AccountPage() {
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
