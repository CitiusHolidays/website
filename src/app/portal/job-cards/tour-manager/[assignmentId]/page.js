import { anyApi } from "convex/server";
import { redirect } from "next/navigation";
import TourManagerAllocationUnavailable from "@/components/portal/jobCard/TourManagerAllocationUnavailable";
import PortalNavigationPalette from "@/components/portal/PortalNavigationPalette";
import { fetchAuthQuery, getToken } from "@/lib/auth-server";

/**
 * Where a "Tour Manager allocated" notification lands. The notification carries the assignment
 * id, so this resolves the assignment's Job Card on the server and replaces the address with the
 * card. The server answers null when the card cannot be opened (the allocation was removed, it
 * has no Job Card, or the caller's role does not reach it), and the page offers the list instead.
 */
export default async function PortalTourManagerAllocationPage({ params }) {
  const [{ assignmentId }, token] = await Promise.all([params, getToken()]);
  // Without a session the portal layout sends the visitor to sign in and back here.
  const jobCardId = token
    ? await fetchAuthQuery(
        anyApi.crm.jobCards.getJobCardIdForTourManagerAssignment,
        { assignmentId },
        { token }
      )
    : null;
  if (jobCardId) {
    redirect(`/portal/job-cards/${encodeURIComponent(jobCardId)}`);
  }
  return (
    <PortalNavigationPalette>
      <div className="mx-auto max-w-7xl">
        <TourManagerAllocationUnavailable />
      </div>
    </PortalNavigationPalette>
  );
}
