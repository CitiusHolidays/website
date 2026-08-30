import { PILGRIMAGE_CONTACT_HREFS } from "../../lib/public/contactIntent";
import { getTrailBySlug } from "./helpers.js";

const PUBLISHED_ROUTE_FIT_SLUGS = ["kailash-mansarovar-14day", "kailash-aerial-3day"];

export function resolvePilgrimageTrailContactContext(value) {
  const trail = getTrailBySlug(value);
  if (!trail) {
    return null;
  }

  return {
    slug: trail.slug,
    status: trail.status,
    title: trail.title,
  };
}

export function getPilgrimageTrailContactHref(kind, trailSlug) {
  const baseHref =
    kind === "callback" ? PILGRIMAGE_CONTACT_HREFS.callback : PILGRIMAGE_CONTACT_HREFS.enquiry;
  const trail = resolvePilgrimageTrailContactContext(trailSlug);
  return trail ? `${baseHref}&trail=${encodeURIComponent(trail.slug)}` : baseHref;
}

export function getPublishedPilgrimageRouteFitOptions() {
  return PUBLISHED_ROUTE_FIT_SLUGS.flatMap((slug) => {
    const trail = getTrailBySlug(slug);
    if (!(trail?.status === "published" && trail.quickFacts?.duration && trail.quickFacts?.route)) {
      return [];
    }

    return [
      {
        contactHref: getPilgrimageTrailContactHref("enquiry", trail.slug),
        detailHref: `/pilgrimage/${trail.slug}`,
        duration: trail.quickFacts.duration,
        route: trail.quickFacts.route,
        slug: trail.slug,
        title: trail.title,
      },
    ];
  });
}
