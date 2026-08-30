import { TRAILS as trails } from "./trails/catalog.js";
import {
  groupTrailsForHub as resolveGroupedTrailsForHub,
  getTrailBySlug as resolveTrailBySlug,
  getTrailSlugsForStaticParams as resolveTrailSlugsForStaticParams,
  getTrailsForHub as resolveTrailsForHub,
  getTrailTestimonials as resolveTrailTestimonials,
  toYoutubeEmbedUrl as resolveYoutubeEmbedUrl,
} from "./trails/helpers.js";
import {
  getPilgrimageTrailContactHref as resolvePilgrimageTrailContactHref,
  getPublishedPilgrimageRouteFitOptions as resolvePublishedPilgrimageRouteFitOptions,
  resolvePilgrimageTrailContactContext as resolveTrailContactContext,
} from "./trails/routeFit.js";
import {
  sacredSites as sites,
  kailashTestimonials as testimonials,
} from "./trails/supportingContent.js";

export const TRAILS = trails;
export const getTrailBySlug = resolveTrailBySlug;
export const getTrailSlugsForStaticParams = resolveTrailSlugsForStaticParams;
export const getTrailsForHub = resolveTrailsForHub;
export const getTrailTestimonials = resolveTrailTestimonials;
export const groupTrailsForHub = resolveGroupedTrailsForHub;
export const toYoutubeEmbedUrl = resolveYoutubeEmbedUrl;
export const getPilgrimageTrailContactHref = resolvePilgrimageTrailContactHref;
export const getPublishedPilgrimageRouteFitOptions = resolvePublishedPilgrimageRouteFitOptions;
export const resolvePilgrimageTrailContactContext = resolveTrailContactContext;
export const kailashTestimonials = testimonials;
export const sacredSites = sites;
