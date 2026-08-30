import { Suspense } from "react";
import JobCardCommandCenter from "@/components/portal/jobCard/JobCardCommandCenter";

function JobCardCommandCenterLoading() {
  return (
    <section aria-busy="true" aria-label="Loading Job Card workspace" className="space-y-4">
      <div className="sr-only" role="status">
        Checking Job Card access
      </div>
      <div className="rounded-lg border border-brand-border bg-white p-4">
        <div aria-hidden="true" className="h-3 w-28 rounded bg-brand-border/60" />
        <div aria-hidden="true" className="mt-3 h-7 w-52 rounded bg-brand-border/45" />
        <p className="mt-3 font-sans text-brand-muted text-sm">Checking record access…</p>
      </div>
      <div
        aria-hidden="true"
        className="h-64 rounded-lg border border-brand-border bg-white motion-safe:animate-pulse"
      />
    </section>
  );
}

async function JobCardCommandCenterContent({ params }) {
  const { jobCardId } = await params;
  return <JobCardCommandCenter jobCardId={jobCardId} />;
}

export default function PortalJobCardCommandCenterPage({ params }) {
  return (
    <div className="mx-auto max-w-7xl">
      <Suspense fallback={<JobCardCommandCenterLoading />}>
        <JobCardCommandCenterContent params={params} />
      </Suspense>
    </div>
  );
}
