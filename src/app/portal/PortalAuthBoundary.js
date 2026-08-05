import { anyApi } from "convex/server";
import { redirect } from "next/navigation";
import PortalShell from "@/components/portal/PortalShell";
import { fetchAuthMutation, fetchAuthQuery, getToken, requireAuth } from "@/lib/auth-server";

// Portal auth, role permissions, CRM identity, saved views, and notifications
// resolve from request headers on every request and must stay outside use cache.
export default async function PortalAuthBoundary({ children }) {
  const token = await getToken();
  const authOptions = { token };
  const { user } = await requireAuth("/portal", authOptions);
  await fetchAuthMutation(anyApi.authSync.syncMyAuthIdentity, {}, authOptions);
  const access = await fetchAuthQuery(anyApi.crm.staff.getMyPortalAccess, {}, authOptions);

  if (!access?.allowed) {
    redirect("/account?portal=unauthorized");
  }

  return (
    <PortalShell access={access} user={user}>
      {children}
    </PortalShell>
  );
}
