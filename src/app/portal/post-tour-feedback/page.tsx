import { Suspense } from "react";
import PortalNavigationPalette from "@/components/portal/PortalNavigationPalette";
import PostTourFeedbackWorkspace from "@/components/portal/postTour/PostTourFeedbackWorkspace";

export const metadata = { title: "Post-tour feedback | Citius Connect" };

interface PageProps {
  searchParams: Promise<{ jobCardId?: string; reportId?: string; view?: string }>;
}

async function FeedbackContent({ searchParams }: PageProps) {
  const { jobCardId, reportId, view } = await searchParams;
  return (
    <PostTourFeedbackWorkspace
      initialJobCardId={jobCardId}
      initialReportId={reportId}
      initialView={view}
    />
  );
}

export default function PostTourFeedbackPage(props: PageProps) {
  return (
    <PortalNavigationPalette>
      <Suspense fallback={<p role="status">Loading post-tour feedback...</p>}>
        <FeedbackContent {...props} />
      </Suspense>
    </PortalNavigationPalette>
  );
}
