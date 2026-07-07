"use client";

import { api } from "@convex/_generated/api";
import { useQuery } from "convex/react";
import YatriPassportCard from "@/components/sacredBharat/YatriPassportCard";

export default function YatriPassportPageClient({ slug }) {
  const passport = useQuery(api.sacredBharat.getPublicPassportBySlug, { slug });
  const currentUrl =
    typeof window === "undefined" ? "" : `${window.location.origin}/sacred-bharat/yatris/${slug}`;

  return (
    <main className="min-h-screen bg-[#fdfcfb] px-4 py-8 md:py-12">
      <div className="mx-auto max-w-6xl">
        {passport === undefined ? (
          <div className="h-64 animate-pulse rounded-lg bg-brand-light" />
        ) : (
          <YatriPassportCard currentUrl={currentUrl} passport={passport} />
        )}
      </div>
    </main>
  );
}
