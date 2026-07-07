import { anyApi } from "convex/server";
import { unstable_noStore } from "next/cache";
import { redirect } from "next/navigation";
import PortalShell from "@/components/portal/PortalShell";
import ReducedMotionProvider from "@/components/providers/ReducedMotionProvider";
import { fetchAuthMutation, fetchAuthQuery, requireAuth } from "@/lib/auth-server";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export const metadata = {
  description: "Internal Citius Holidays CRM portal.",
  title: "TravelCRM Portal | Citius Holidays",
};

export default async function PortalLayout({ children }) {
  unstable_noStore();

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
