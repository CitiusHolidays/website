import { Suspense } from "react";
import PublicRouteLoadingShell from "@/components/layout/PublicRouteLoadingShell";
import SacredBharatGroupPageClient from "./page.client";

export const metadata = {
  description: "Private Sacred Bharat group leaderboard for invited yatris.",
  title: "Sacred Bharat Group",
};

export default function SacredBharatGroupPage({ params }) {
  return (
    <Suspense
      fallback={
        <PublicRouteLoadingShell
          description="The invited Yatri leaderboard and shared pilgrimage progress are loading."
          eyebrow="Sacred Bharat"
          title="Sacred Bharat group"
          tone="sacred"
        />
      }
    >
      <SacredBharatGroupContent params={params} />
    </Suspense>
  );
}

async function SacredBharatGroupContent({ params }) {
  const { groupId } = await params;
  return <SacredBharatGroupPageClient groupId={groupId} />;
}
