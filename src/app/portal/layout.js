import { Suspense } from "react";
import PortalLoadingShell from "@/components/portal/PortalLoadingShell";
import PortalMotionThemeProvider from "@/components/providers/PortalMotionThemeProvider";
import ReducedMotionProvider from "@/components/providers/ReducedMotionProvider";
import PortalAuthBoundary from "./PortalAuthBoundary";

// Portal auth, role permissions, CRM identity, saved views, and notifications
// resolve from request headers on every request and must stay outside use cache.
export const instant = false;

export const metadata = {
  description: "Internal Citius Holidays CRM portal.",
  title: "TravelCRM Portal | Citius Holidays",
};

export default function PortalLayout({ children }) {
  return (
    <ReducedMotionProvider>
      <PortalMotionThemeProvider>
        <Suspense fallback={<PortalLoadingShell />}>
          <PortalAuthBoundary>{children}</PortalAuthBoundary>
        </Suspense>
      </PortalMotionThemeProvider>
    </ReducedMotionProvider>
  );
}
