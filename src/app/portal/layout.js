import { anyApi } from "convex/server";
import { unstable_noStore } from "next/cache";
import { redirect } from "next/navigation";
import PortalShell from "@/components/portal/PortalShell";
import { fetchAuthQuery, requireAuth } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "TravelCRM Portal | Citius Travel",
  description: "Internal Citius Holidays CRM portal.",
};

export default async function PortalLayout({ children }) {
  unstable_noStore();

  const { user } = await requireAuth("/portal");
  const access = await fetchAuthQuery(anyApi.crm.staff.getMyPortalAccess, {});

  if (!access?.allowed) {
    redirect("/account?portal=unauthorized");
  }

  return (
    <PortalShell access={access} user={user}>
      {children}
    </PortalShell>
  );
}
