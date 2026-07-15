import { cachedSanityFetch } from "@/sanity/cachedFetch";
import { GALLERY_DOCUMENT_QUERY } from "@/sanity/queries/gallery";
import MicePageClient from "./page.client";

export const generateMetadata = () => ({
  description:
    "Citius specializes in planning and executing flawless Meetings, Incentives, Conferences, and Exhibitions (MICE) worldwide. Contact us for a proposal.",
  title: "Expert MICE Services & Corporate Event Planning | Citius",
});

export default async function MicePage() {
  const data = await cachedSanityFetch(GALLERY_DOCUMENT_QUERY, {}, ["gallery"]);
  return <MicePageClient images={data?.images || []} />;
}
