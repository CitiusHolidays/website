import { anyApi } from "convex/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import PortalShell from "@/components/portal/PortalShell";
import { ConvexClientProvider } from "@/components/providers/ConvexClientProvider";
import PortalMotionThemeProvider from "@/components/providers/PortalMotionThemeProvider";
import ReducedMotionProvider from "@/components/providers/ReducedMotionProvider";
import { fetchAuthMutation, getToken, requireAuth } from "@/lib/auth-server";
import { RETURN_PATH_HEADER } from "@/lib/requestReturnPath";

// All request-derived identity, authorization, and CRM work stays behind this
// boundary. Its parent may stream only a generic shell with no user or CRM data.
export default async function PortalAuthBoundary({ children }) {
  await connection();
  const token = await getToken();
  const authOptions = { token };
  // Two stages instead of three: the session check runs alongside one call
  // that syncs this login's identity and returns portal access from the same
  // transaction. A failed call is held until the session check has had the
  // chance to redirect a signed-out request to sign in.
  const bootstrap = token
    ? fetchAuthMutation(anyApi.authSync.syncMyPortalAccess, {}, authOptions).then(
        (portalAccess) => ({ access: portalAccess, failure: null }),
        (cause) => ({ access: null, failure: cause })
      )
    : Promise.resolve({ access: null, failure: null });
  // Set by src/proxy.js, so a signed-out visitor returns to the page they asked for.
  const returnPath = (await headers()).get(RETURN_PATH_HEADER);
  const { user } = await requireAuth("/portal", authOptions, { returnPath });
  const { access, failure } = await bootstrap;
  if (failure) {
    throw failure;
  }

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
