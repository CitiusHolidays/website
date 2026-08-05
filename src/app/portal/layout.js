import { anyApi } from "convex/server";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import PortalShell from "@/components/portal/PortalShell";
import PortalMotionThemeProvider from "@/components/providers/PortalMotionThemeProvider";
import ReducedMotionProvider from "@/components/providers/ReducedMotionProvider";
import { fetchAuthMutation, fetchAuthQuery, getToken, requireAuth } from "@/lib/auth-server";

// Portal auth, role permissions, CRM identity, saved views, and notifications
// resolve from request headers on every request and must stay outside use cache.
export const instant = false;

export const metadata = {
  description: "Internal Citius Holidays CRM portal.",
  title: "TravelCRM Portal | Citius Holidays",
};

export default async function PortalLayout({ children }) {
  // Never let Cache Components produce a reusable shell for a request whose
  // auth state comes from cookies. This intentionally blocks the segment at
  // the request boundary instead of adding a Suspense auth shell.
  await connection();
  const token = await getToken();
  const authOptions = { token };
  const { user } = await requireAuth("/portal", authOptions);
  await fetchAuthMutation(anyApi.authSync.syncMyAuthIdentity, {}, authOptions);
  const access = await fetchAuthQuery(anyApi.crm.staff.getMyPortalAccess, {}, authOptions);

  if (!access?.allowed) {
    redirect("/account?portal=unauthorized");
  }

  return (
    <ReducedMotionProvider>
      <PortalMotionThemeProvider>
        <PortalShell access={access} user={user}>
          {children}
        </PortalShell>
      </PortalMotionThemeProvider>
    </ReducedMotionProvider>
  );
}
