import { anyApi } from "convex/server";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import PortalShell from "@/components/portal/PortalShell";
import PortalMotionThemeProvider from "@/components/providers/PortalMotionThemeProvider";
import ReducedMotionProvider from "@/components/providers/ReducedMotionProvider";
import { fetchAuthMutation, fetchAuthQuery, getToken, requireAuth } from "@/lib/auth-server";

// All request-derived identity, authorization, and CRM work stays behind this
// boundary. Its parent may stream only a generic shell with no user or CRM data.
export default async function PortalAuthBoundary({ children }) {
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
