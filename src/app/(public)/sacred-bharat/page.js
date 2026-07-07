import SacredBharatPageClient from "./page.client";

export const metadata = {
  description:
    "India's gamified spiritual travel platform. Mark temples visited, complete 12 spiritual trails, earn badges and points, and build your digital pilgrimage legacy.",
  openGraph: {
    description:
      "Track your pilgrimage across India's sacred trails. Free to play — sign in to save and join the leaderboard.",
    title: "Sacred Bharat – Journey of the Soul™",
  },
  title: "Sacred Bharat – Journey of the Soul | Citius Holidays",
};

export default function SacredBharatPage() {
  return <SacredBharatPageClient />;
}
