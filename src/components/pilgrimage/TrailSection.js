"use client";

import { useState } from "react";
import { getTrailTestimonials, toYoutubeEmbedUrl } from "@/data/trails";
import { cn } from "@/utils/cn";
import { TrailCta, TrailHeader, TrailTabContent, TrailTabs } from "./trailSection/TrailShell";

const EMPTY_RELATED_BLOG_POSTS = [];

export default function TrailSection({
  trail,
  className,
  isAlternate,
  relatedBlogPosts = EMPTY_RELATED_BLOG_POSTS,
  embedded = false,
}) {
  const [activeTab, setActiveTab] = useState("overview");

  if (!trail) {
    return null;
  }

  const {
    title,
    subtitle,
    tagline,
    positioning,
    highlights,
    itinerary,
    details,
    info,
    layoutVariant = "trek",
    status,
    gallery = [],
    bookingOptions = [],
    media,
  } = trail;
  const isAerial = layoutVariant === "aerial";
  const isComingSoon = status === "comingSoon";
  const reviewsList =
    trail.testimonials?.length > 0 ? trail.testimonials : getTrailTestimonials(trail);
  const flags = {
    hasBlogs: relatedBlogPosts.length > 0,
    hasBooking: bookingOptions.length > 0,
    hasGallery: gallery.length > 0,
    hasHighlights: highlights && highlights.length > 0,
    hasInfo: Boolean(info),
    hasItinerary: itinerary && itinerary.length > 0,
    hasMedia:
      Boolean(media?.videoUrl && toYoutubeEmbedUrl(media.videoUrl)) || Boolean(media?.arUrl),
    hasPackageDetails: Boolean(details),
    hasReviews: reviewsList.length > 0,
  };
  const legacySectionId = isAerial ? "package-aerial" : "package-14day";

  return (
    <section
      className={cn(
        embedded
          ? "scroll-mt-20 bg-white py-6 md:py-12"
          : cn("scroll-mt-20 py-16 md:py-32", isAlternate ? "bg-[#f8f5f2]" : "bg-white"),
        className
      )}
      id={trail.slug ? `trail-${trail.slug}` : legacySectionId}
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {!embedded && (
          <TrailHeader
            isComingSoon={isComingSoon}
            positioning={positioning}
            subtitle={subtitle}
            tagline={tagline}
            title={title}
            trail={trail}
          />
        )}

        {embedded && isComingSoon && (
          <p className="mx-auto mb-8 max-w-xl rounded-full border border-amber-100 bg-amber-50 px-4 py-2 text-center text-amber-800 text-sm">
            This programme is not yet open for booking , explore the overview and register your
            interest below.
          </p>
        )}

        <TrailTabs activeTab={activeTab} flags={flags} setActiveTab={setActiveTab} />
        <TrailTabContent
          activeTab={activeTab}
          flags={flags}
          relatedBlogPosts={relatedBlogPosts}
          reviewsList={reviewsList}
          trail={trail}
        />
        <TrailCta isAerial={isAerial} />
      </div>
    </section>
  );
}
