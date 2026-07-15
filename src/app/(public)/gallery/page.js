import { cachedSanityFetch } from "@/sanity/cachedFetch";
import { GALLERY_DOCUMENT_QUERY } from "@/sanity/queries/gallery";
import GalleryPageClient from "./page.client";

export const generateMetadata = () => ({
  description: "Browse memorable moments and events curated by Citius across the globe.",
  title: "Gallery | Citius Experiences",
});

export default async function GalleryPage() {
  const data = await cachedSanityFetch(GALLERY_DOCUMENT_QUERY, {}, ["gallery"]);
  return <GalleryPageClient images={data?.images || []} />;
}
