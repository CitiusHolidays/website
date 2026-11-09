import { anyApi } from "convex/server";
import { connection } from "next/server";
import AccountIdentityReview from "@/components/account/AccountIdentityReview";
import { fetchAuthMutation, fetchAuthQuery, getToken, requireAuth } from "@/lib/auth-server";
import { captureRequestReferenceNow } from "@/lib/requestReferenceTime";
import AccountClient from "./page.client.js";

// Account data is identity-scoped and must be resolved from request headers on every request.
export const instant = false;

export const metadata = {
  description: "Manage your bookings and profile settings.",
  title: "My Account",
};

const ACCOUNT_TABS = new Set(["journeys", "profile", "settings"]);

export default async function AccountPage({ searchParams } = {}) {
  // Account data is identity-scoped. Explicitly wait for a real request so a
  // Cache Components shell can never be reused across customer sessions.
  await connection();
  const query = (await searchParams) ?? {};
  const requestedTab = ACCOUNT_TABS.has(query.tab) ? query.tab : null;
  const token = await getToken();
  const authOptions = { token };
  // A signed-out visitor comes back to the tab they asked for after signing in.
  const returnPath = requestedTab ? `/account?tab=${requestedTab}` : "/account";
  const { user } = await requireAuth("/account", authOptions, { returnPath });
  // Commit a conflict/quarantine result before any later mutation could throw
  // and roll its transaction back.
  const identityLink = await fetchAuthMutation(
    anyApi.userProfiles.establishMyIdentity,
    {},
    authOptions
  );
  if (identityLink.status !== "linked") {
    // Retrying cannot fix a conflict, so show a way to reach the team instead of an error page.
    return <AccountIdentityReview />;
  }
  await fetchAuthMutation(anyApi.userProfiles.ensureMyProfile, {}, authOptions);
  const referenceNow = captureRequestReferenceNow();
  const [journeys, confirmedTripPage] = await Promise.all([
    fetchAuthQuery(anyApi.bookings.getMyJourneySummaries, { referenceNow }, authOptions),
    fetchAuthQuery(
      anyApi.customerConfirmedTrips.getMyConfirmedTripPackets,
      { paginationOpts: { cursor: null, numItems: 20 } },
      authOptions
    ),
  ]);

  return (
    <AccountClient
      confirmedTripPage={confirmedTripPage}
      initialTab={requestedTab ?? "journeys"}
      journeys={journeys}
      portalUnauthorized={query.portal === "unauthorized"}
      user={user}
    />
  );
}
