import { anyApi } from "convex/server";
import { connection } from "next/server";
import { fetchAuthMutation, fetchAuthQuery, requireAuth } from "@/lib/auth-server";
import AccountClient from "./page.client.js";

// Account data is identity-scoped and must be resolved from request headers on every request.
export const instant = false;

export const metadata = {
  description: "Manage your bookings and profile settings.",
  title: "My Account | Citius Holidays",
};

export default async function AccountPage() {
  // Account data is identity-scoped. Explicitly wait for a real request so a
  // Cache Components shell can never be reused across customer sessions.
  await connection();
  const { user } = await requireAuth("/account");
  const [, bookings] = await Promise.all([
    fetchAuthMutation(anyApi.userProfiles.ensureMyProfile, {}),
    fetchAuthQuery(anyApi.bookings.getMyBookings, {}),
  ]);

  return <AccountClient bookings={bookings} user={user} />;
}
