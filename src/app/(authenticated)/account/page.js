import { anyApi } from "convex/server";
import { connection } from "next/server";
import { fetchAuthMutation, fetchAuthQuery, getToken, requireAuth } from "@/lib/auth-server";
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
  const token = await getToken();
  const authOptions = { token };
  const { user } = await requireAuth("/account", authOptions);
  const [, journeys, confirmedTrips] = await Promise.all([
    fetchAuthMutation(anyApi.userProfiles.ensureMyProfile, {}, authOptions),
    fetchAuthQuery(anyApi.bookings.getMyJourneySummaries, {}, authOptions),
    fetchAuthQuery(anyApi.customerConfirmedTrips.getMyConfirmedTripPackets, {}, authOptions),
  ]);

  return <AccountClient confirmedTrips={confirmedTrips} journeys={journeys} user={user} />;
}
