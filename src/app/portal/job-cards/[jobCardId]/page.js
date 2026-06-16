import JobCardCommandCenter from "@/components/portal/jobCard/JobCardCommandCenter";

export default async function PortalJobCardCommandCenterPage({ params }) {
  const { jobCardId } = await params;
  return (
    <div className="mx-auto max-w-7xl">
      <JobCardCommandCenter jobCardId={jobCardId} />
    </div>
  );
}
