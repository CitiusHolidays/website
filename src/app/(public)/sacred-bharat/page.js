import SacredBharatPageClient from "./page.client";

export const metadata = {
  description:
    "India's gamified spiritual travel platform. Mark temples visited, complete 12 spiritual trails, earn badges and points, and build your digital pilgrimage legacy.",
  openGraph: {
    description:
      "Track your pilgrimage across India's sacred trails. Free to play — sign in to save and join the leaderboard.",
    images: [
      {
        alt: "Sacred Bharat journeys along the ghats of Varanasi",
        height: 630,
        url: "/social/sacred-bharat-social-card.jpg",
        width: 1200,
      },
    ],
    title: "Sacred Bharat – Journey of the Soul",
  },
  title: "Sacred Bharat – Journey of the Soul",
  twitter: {
    card: "summary_large_image",
    description:
      "Track your pilgrimage across India's sacred trails and build a thoughtful record of the places you visit.",
    images: ["/social/sacred-bharat-social-card.jpg"],
    title: "Sacred Bharat – Journey of the Soul",
  },
};

export default function SacredBharatPage() {
  return <SacredBharatPageClient />;
}
