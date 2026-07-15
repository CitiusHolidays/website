import { TRAIL_BY_SLUG, TRAIL_GROUPS, TRAILS } from "./catalog.js";
import { kailashTestimonials } from "./supportingContent.js";

export function getTrailBySlug(slug) {
  if (!slug) {
    return null;
  }
  return TRAIL_BY_SLUG[slug] ?? null;
}

export function getTrailsForHub() {
  return TRAILS.filter((trail) => trail.status === "published" || trail.status === "comingSoon");
}

export function getTrailSlugsForStaticParams() {
  return getTrailsForHub().map((trail) => ({ slug: trail.slug }));
}

export function getTrailTestimonials(trail) {
  if (!trail?.testimonialIds?.length) {
    return [];
  }
  const testimonialIds = new Set(trail.testimonialIds);
  return kailashTestimonials.filter((testimonial) => testimonialIds.has(testimonial.id));
}

export function groupTrailsForHub(trailList) {
  const groupsById = new Map(TRAIL_GROUPS.map((group) => [group.id, { ...group, trails: [] }]));
  for (const trail of trailList) {
    groupsById.get(trail.group)?.trails.push(trail);
  }
  return TRAIL_GROUPS.flatMap((group) => {
    const populatedGroup = groupsById.get(group.id);
    return populatedGroup.trails.length > 0 ? [populatedGroup] : [];
  });
}

/** YouTube watch/share URLs to the corresponding iframe embed URL. */
export function toYoutubeEmbedUrl(url) {
  if (!url || typeof url !== "string") {
    return null;
  }
  const value = url.trim();
  if (!value) {
    return null;
  }
  if (value.includes("youtube.com/embed/")) {
    return value.split("?")[0];
  }
  try {
    const parsed = new URL(value);
    if (parsed.hostname.includes("youtu.be")) {
      const id = parsed.pathname.replace(/^\//, "").split("/")[0];
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (parsed.hostname.includes("youtube.com")) {
      const id = parsed.searchParams.get("v");
      if (id) {
        return `https://www.youtube.com/embed/${id}`;
      }
    }
  } catch {
    return null;
  }
  return null;
}
