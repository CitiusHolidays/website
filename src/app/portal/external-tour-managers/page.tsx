import PortalNavigationPalette from "@/components/portal/PortalNavigationPalette";
import ExternalTourManagersWorkspace from "@/components/portal/travel/ExternalTourManagersWorkspace";
export const metadata = { title: "External tour managers | Citius Connect" };
export default function ExternalTourManagersPage() {
  return (
    <PortalNavigationPalette>
      <ExternalTourManagersWorkspace />
    </PortalNavigationPalette>
  );
}
