import { anyApi } from "convex/server";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import PortalShell from "@/components/portal/PortalShell";
import { ConvexClientProvider } from "@/components/providers/ConvexClientProvider";
import PortalMotionThemeProvider from "@/components/providers/PortalMotionThemeProvider";
import ReducedMotionProvider from "@/components/providers/ReducedMotionProvider";
import { fetchAuthMutation, fetchAuthQuery, getToken, requireAuth } from "@/lib/auth-server";

// All request-derived identity, authorization, and CRM work stays behind this
// boundary. Its parent may stream only a generic shell with no user or CRM data.
export default async function PortalAuthBoundary({ children }) {
  await connection();
  const token = await getToken();
  const authOptions = { token };
  // The session check and the identity sync don't depend on each other, so
  // they share one round trip to Convex. Access is still read after the sync,
  // because a first sign-in only links the staff record there. A failed sync
  // is held until the session check has had the chance to redirect.
  const synced = token
    ? fetchAuthMutation(anyApi.authSync.syncMyAuthIdentity, {}, authOptions).then(
        () => null,
        (error) => ({ error })
      )
    : Promise.resolve(null);
  const { user } = await requireAuth("/portal", authOptions);
  const syncFailure = await synced;
  if (syncFailure) {
    throw syncFailure.error;
  }
  const access = await fetchAuthQuery(anyApi.crm.staff.getMyPortalAccess, {}, authOptions);

  if (!access?.allowed) {
    redirect("/account?portal=unauthorized");
  }

  // The browser starts on the token this request already holds, so Convex
  // connects and tables start loading without first fetching a session and a
  // fresh token. The page is private and never cached (next.config.mjs).
  return (
    <ConvexClientProvider initialToken={token}>
      <ReducedMotionProvider>
        <PortalMotionThemeProvider>
          <PortalShell access={access} user={user}>
            {children}
          </PortalShell>
        </PortalMotionThemeProvider>
      </ReducedMotionProvider>
    </ConvexClientProvider>
  );
}
