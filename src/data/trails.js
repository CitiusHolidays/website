import {
  TRAIL_BY_SLUG as trailBySlug,
  TRAIL_GROUPS as trailGroups,
  TRAILS as trails,
} from "./trails/catalog.js";
import {
  groupTrailsForHub as resolveGroupedTrailsForHub,
  getTrailBySlug as resolveTrailBySlug,
  getTrailSlugsForStaticParams as resolveTrailSlugsForStaticParams,
  getTrailsForHub as resolveTrailsForHub,
  getTrailTestimonials as resolveTrailTestimonials,
  toYoutubeEmbedUrl as resolveYoutubeEmbedUrl,
} from "./trails/helpers.js";
import {
  sacredSites as sites,
  kailashTestimonials as testimonials,
} from "./trails/supportingContent.js";

export const TRAIL_BY_SLUG = trailBySlug;
export const TRAIL_GROUPS = trailGroups;
export const TRAILS = trails;
export const getTrailBySlug = resolveTrailBySlug;
export const getTrailSlugsForStaticParams = resolveTrailSlugsForStaticParams;
export const getTrailsForHub = resolveTrailsForHub;
export const getTrailTestimonials = resolveTrailTestimonials;
export const groupTrailsForHub = resolveGroupedTrailsForHub;
export const toYoutubeEmbedUrl = resolveYoutubeEmbedUrl;
export const kailashTestimonials = testimonials;
export const sacredSites = sites;
