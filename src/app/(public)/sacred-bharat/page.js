import { redirect } from "next/navigation";

export const metadata = {
  description: "Five sacred places. One visual detail each. Discover Sacred Bharat / 001.",
  openGraph: {
    description: "Five sacred places. One visual detail each. How many do you recognise?",
    images: [
      {
        alt: "Sacred Bharat / 001 — Sacred Details",
        height: 630,
        url: "/social/sacred-bharat-social-card.jpg",
        width: 1200,
      },
    ],
    title: "Sacred Bharat / 001 — Sacred Details",
  },
  title: "Sacred Bharat / 001 — Sacred Details",
  twitter: {
    card: "summary_large_image",
    description: "Five sacred places. One visual detail each. How many do you recognise?",
    images: ["/social/sacred-bharat-social-card.jpg"],
    title: "Sacred Bharat / 001 — Sacred Details",
  },
};

export default function SacredBharatPage() {
  redirect("/sacred-bharat/001");
}
