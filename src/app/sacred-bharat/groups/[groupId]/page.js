import SacredBharatGroupPageClient from "./page.client";

export const metadata = {
  title: "Sacred Bharat Group",
  description: "Private Sacred Bharat group leaderboard for invited yatris.",
};

export default async function SacredBharatGroupPage({ params }) {
  const { groupId } = await params;
  return <SacredBharatGroupPageClient groupId={groupId} />;
}
