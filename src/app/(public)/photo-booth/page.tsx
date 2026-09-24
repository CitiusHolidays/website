import type { Metadata } from "next";
import EventPhotoBooth from "@/components/eventPhotoBooth/EventPhotoBooth";

export const metadata: Metadata = {
  description: "Create and share your destination photo with Citius Holidays at the event.",
  robots: { follow: false, index: false },
  title: "Event Photo Booth | Citius Holidays",
};

export default function PhotoBoothPage() {
  return <EventPhotoBooth />;
}
