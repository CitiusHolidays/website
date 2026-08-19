import SacredBharatEdition from "@/components/sacredBharat/edition/SacredBharatEdition";

export const metadata = {
  description: "Five sacred places. One visual detail each. How many do you recognise?",
  openGraph: {
    description: "Five sacred places. One visual detail each. How many do you recognise?",
    images: [
      {
        alt: "Sacred Bharat / 001 — Sacred Details",
        height: 1800,
        url: "/images/sacred-bharat/001/amritsar.webp",
        width: 1440,
      },
    ],
    title: "Sacred Bharat / 001 — Sacred Details",
  },
  title: "Sacred Bharat / 001 — Sacred Details",
  twitter: {
    card: "summary_large_image",
    description: "Five sacred places. One visual detail each. How many do you recognise?",
    images: ["/images/sacred-bharat/001/amritsar.webp"],
    title: "Sacred Bharat / 001 — Sacred Details",
  },
};

export default function SacredBharatEditionPage() {
  return <SacredBharatEdition />;
}
