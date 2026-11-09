import JobCardCommandCenter from "@/components/portal/jobCard/JobCardCommandCenter";
import PortalNavigationPalette from "@/components/portal/PortalNavigationPalette";

export default async function PortalJobCardCommandCenterPage({ params }) {
  const { jobCardId } = await params;
  return (
    <PortalNavigationPalette>
      <div className="mx-auto max-w-7xl">
        <JobCardCommandCenter jobCardId={jobCardId} />
      </div>
    </PortalNavigationPalette>
  );
}
