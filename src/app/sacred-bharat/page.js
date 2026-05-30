import SacredBharatPageClient from "./page.client";

export const metadata = {
  title: "Sacred Bharat – Journey of the Soul | Citius Holidays",
  description:
    "India's gamified spiritual travel platform. Mark temples visited, complete 12 spiritual trails, earn badges and points, and build your digital pilgrimage legacy.",
  openGraph: {
    title: "Sacred Bharat – Journey of the Soul™",
    description:
      "Track your pilgrimage across India's sacred trails. Free to play — sign in to save and join the leaderboard.",
  },
};

export default function SacredBharatPage() {
  return <SacredBharatPageClient />;
}
