import { notFound } from "next/navigation";
import { Suspense } from "react";
import PublicRouteLoadingShell from "@/components/layout/PublicRouteLoadingShell";
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
    description: `Complete the ${trail.title}, earn the ${trail.badgeName} badge and +${trail.completionBonus} bonus points.`,
    title: `${trail.title} | Sacred Bharat`,
  };
}

export default function SacredBharatTrailPage({ params }) {
  return (
    <Suspense
      fallback={
        <PublicRouteLoadingShell
          description="Temple milestones, trail guidance, and the completion badge are loading."
          eyebrow="Sacred Bharat trails"
          title="Sacred Bharat trail"
          tone="sacred"
        />
      }
    >
      <SacredBharatTrailContent params={params} />
    </Suspense>
  );
}

async function SacredBharatTrailContent({ params }) {
  const { slug } = await params;
  const trail = getTrailBySlug(slug);
  if (!trail) {
    notFound();
  }
  return <TrailDetailClient trail={trail} />;
}
