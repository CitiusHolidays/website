import { anyApi } from "convex/server";
import { redirect } from "next/navigation";
import PortalShell from "@/components/portal/PortalShell";
import ReducedMotionProvider from "@/components/providers/ReducedMotionProvider";
import { fetchAuthMutation, fetchAuthQuery, requireAuth } from "@/lib/auth-server";

// Portal auth, role permissions, CRM identity, saved views, and notifications
// resolve from request headers on every request and must stay outside use cache.
export const instant = false;

export const metadata = {
  description: "Internal Citius Holidays CRM portal.",
  title: "TravelCRM Portal | Citius Holidays",
};

export default async function PortalLayout({ children }) {
  const { user } = await requireAuth("/portal");
  await fetchAuthMutation(anyApi.authSync.syncMyAuthIdentity, {});
  const access = await fetchAuthQuery(anyApi.crm.staff.getMyPortalAccess, {});

  if (!access?.allowed) {
    redirect("/account?portal=unauthorized");
  }

  return (
    <ReducedMotionProvider>
      <PortalShell access={access} user={user}>
        {children}
      </PortalShell>
    </ReducedMotionProvider>
  );
}
