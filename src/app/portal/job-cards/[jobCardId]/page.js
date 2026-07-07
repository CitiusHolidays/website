import JobCardCommandCenter from "@/components/portal/jobCard/JobCardCommandCenter";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export default async function PortalJobCardCommandCenterPage({ params }) {
  const { jobCardId } = await params;
  return (
    <div className="mx-auto max-w-7xl">
      <JobCardCommandCenter jobCardId={jobCardId} />
    </div>
  );
}
