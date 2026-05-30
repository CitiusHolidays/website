import { notFound } from "next/navigation";
import { getAllTrailSlugs, getTrailBySlug } from "@/data/sacredBharat/trails";
import TrailDetailClient from "./page.client";

export function generateStaticParams() {
  return getAllTrailSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const trail = getTrailBySlug(slug);
  if (!trail) {
    return { title: "Trail not found | Sacred Bharat" };
  }
  return {
    title: `${trail.title} | Sacred Bharat – Citius Holidays`,
    description: `Complete the ${trail.title}, earn the ${trail.badgeName} badge and +${trail.completionBonus} bonus points.`,
  };
}

export default async function SacredBharatTrailPage({ params }) {
  const { slug } = await params;
  const trail = getTrailBySlug(slug);
  if (!trail) {
    notFound();
  }
  return <TrailDetailClient trail={trail} />;
}
