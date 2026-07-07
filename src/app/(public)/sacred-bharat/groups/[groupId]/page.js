import { Suspense } from "react";
import SacredBharatGroupPageClient from "./page.client";

export const metadata = {
  description: "Private Sacred Bharat group leaderboard for invited yatris.",
  title: "Sacred Bharat Group",
};

export default function SacredBharatGroupPage({ params }) {
  return (
    <Suspense fallback={null}>
      <SacredBharatGroupContent params={params} />
    </Suspense>
  );
}

async function SacredBharatGroupContent({ params }) {
  const { groupId } = await params;
  return <SacredBharatGroupPageClient groupId={groupId} />;
}
