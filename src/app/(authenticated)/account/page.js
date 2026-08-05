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
    let bookings = [];
    let bookingLoadError = "";
    try {
      [, bookings] = await Promise.all([
        fetchAuthMutation(anyApi.userProfiles.ensureMyProfile, {}),
        fetchAuthQuery(anyApi.bookings.getMyBookings, {}),
      ]);
    } catch (error) {
      console.error("Customer Account booking read failed:", error);
      bookingLoadError = "BOOKING_READ_FAILED";
    }
    const referenceNow = Date.now();

    return (
      <AccountClient
        bookingLoadError={bookingLoadError}
        bookings={bookings}
        referenceNow={referenceNow}
        user={user}
      />
    );
  });
}
