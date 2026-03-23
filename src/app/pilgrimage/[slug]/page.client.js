"use client";

import TrailHeroSlideshow from "@/components/pilgrimage/TrailHeroSlideshow";
import TrailSection from "@/components/pilgrimage/TrailSection";

export default function PilgrimageTrailPageClient({ trail, relatedBlogPosts }) {
  return (
    <div className="bg-white min-h-screen">
      <TrailHeroSlideshow trail={trail} />

      <TrailSection
        trail={trail}
        relatedBlogPosts={relatedBlogPosts}
        embedded
        isAlternate={false}
        className="pt-0"
      />
    </div>
  );
}
