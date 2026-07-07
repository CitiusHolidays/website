import { client } from "@/sanity/client";
import { sanityFetchOptions } from "@/sanity/fetchOptions";
import { GALLERY_DOCUMENT_QUERY } from "@/sanity/queries/gallery";
import GalleryPageClient from "./page.client";

export const generateMetadata = () => ({
  description: "Browse memorable moments and events curated by Citius across the globe.",
  title: "Gallery | Citius Experiences",
});

export default async function GalleryPage() {
  const data = await client.fetch(GALLERY_DOCUMENT_QUERY, {}, sanityFetchOptions.gallery);
  return <GalleryPageClient images={data?.images || []} />;
}
