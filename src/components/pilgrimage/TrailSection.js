"use client";

import { useState } from "react";
import { getTrailTestimonials, toYoutubeEmbedUrl } from "@/data/trails";
import { TrailCta, TrailTabContent, TrailTabs } from "./trailSection/TrailShell";

const EMPTY_RELATED_BLOG_POSTS = [];

export default function TrailSection({ trail, relatedBlogPosts = EMPTY_RELATED_BLOG_POSTS }) {
  const [activeTab, setActiveTab] = useState("overview");

  if (!trail) {
    return null;
  }

  const {
    highlights,
    itinerary,
    details,
    info,
    status,
    gallery = [],
    bookingOptions = [],
    media,
  } = trail;
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

  return (
    <section className="scroll-mt-24 bg-public-surface py-6 md:py-10" id={`trail-${trail.slug}`}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <h2 className="sr-only">Programme details</h2>
        <TrailTabs
          activeTab={activeTab}
          flags={flags}
          setActiveTab={setActiveTab}
          trailSlug={trail.slug}
        />
        <TrailTabContent
          activeTab={activeTab}
          flags={flags}
          relatedBlogPosts={relatedBlogPosts}
          reviewsList={reviewsList}
          trail={trail}
        />
        <TrailCta status={status} trailSlug={trail.slug} />
      </div>
    </section>
  );
}
