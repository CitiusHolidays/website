"use client";

import TrailHeroSlideshow from "@/components/pilgrimage/TrailHeroSlideshow";
import TrailSection from "@/components/pilgrimage/TrailSection";

export default function PilgrimageTrailPageClient({ trail, relatedBlogPosts }) {
  return (
    <div className="min-h-screen bg-white">
      <TrailHeroSlideshow trail={trail} />

      <TrailSection
        className="pt-0"
        embedded
        isAlternate={false}
        relatedBlogPosts={relatedBlogPosts}
        trail={trail}
      />
    </div>
  );
}
