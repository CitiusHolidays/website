import { cachedSanityFetch } from "@/sanity/cachedFetch";
import { GALLERY_DOCUMENT_QUERY } from "@/sanity/queries/gallery";
import GalleryPageClient from "./page.client";

export const generateMetadata = () => ({
  description: "Photos from Citius MICE programmes, corporate events, and travel routes.",
  title: "Gallery | Citius Holidays",
});

export default async function GalleryPage() {
  const data = await cachedSanityFetch(GALLERY_DOCUMENT_QUERY, {}, ["gallery"]);
  return <GalleryPageClient images={data?.images || []} />;
}
