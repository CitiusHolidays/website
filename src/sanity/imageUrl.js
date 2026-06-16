import imageUrlBuilder from "@sanity/image-url";

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;

/** Build Sanity CDN image URLs without importing the full Sanity client SDK. */
export function urlFor(source) {
  return projectId && dataset ? imageUrlBuilder({ projectId, dataset }).image(source) : null;
}
