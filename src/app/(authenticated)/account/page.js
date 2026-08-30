import { anyApi } from "convex/server";
import { connection } from "next/server";
import { addAccountJourneyUrlKeys } from "@/lib/accountJourneyUrlKey.server";
import { resolveAccountUrlState } from "@/lib/accountUrlState";
import { fetchAuthMutation, fetchAuthQuery, getToken, requireAuth } from "@/lib/auth-server";
import { captureRequestReferenceNow } from "@/lib/requestReferenceTime";
import AccountClient from "./page.client.js";

// Account data is identity-scoped and must be resolved from request headers on every request.
export const instant = false;

export const metadata = {
  description: "Manage your bookings and profile settings.",
  title: "My Account | Citius Holidays",
};

export default async function AccountPage({ searchParams = Promise.resolve({}) } = {}) {
  // Account data is identity-scoped. Explicitly wait for a real request so a
  // Cache Components shell can never be reused across customer sessions.
  await connection();
  const token = await getToken();
  const authOptions = { token };
  const { user } = await requireAuth("/account", authOptions);
  // Commit a conflict/quarantine result before any later mutation could throw
  // and roll its transaction back.
  const identityLink = await fetchAuthMutation(
    anyApi.userProfiles.establishMyIdentity,
    {},
    authOptions
  );
  if (identityLink.status !== "linked") {
    throw new Error("Account identity requires support review");
  }
  await fetchAuthMutation(anyApi.userProfiles.ensureMyProfile, {}, authOptions);
  const referenceNow = captureRequestReferenceNow();
  const [journeysResult, confirmedTripPage, requestedAccountState] = await Promise.all([
    fetchAuthQuery(anyApi.bookings.getMyJourneySummaries, { referenceNow }, authOptions),
    fetchAuthQuery(
      anyApi.customerConfirmedTrips.getMyConfirmedTripPackets,
      { paginationOpts: { cursor: null, numItems: 20 } },
      authOptions
    ),
    searchParams,
  ]);
  const journeys = addAccountJourneyUrlKeys(journeysResult);
  const initialUrlState = resolveAccountUrlState(requestedAccountState, journeys.summaries);

  return (
    <AccountClient
      confirmedTripPage={confirmedTripPage}
      initialUrlState={initialUrlState}
      journeys={journeys}
      user={user}
    />
  );
}
