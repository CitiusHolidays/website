import { client } from "@/sanity/client";
import { sanityFetchOptions } from "@/sanity/fetchOptions";
import { GALLERY_DOCUMENT_QUERY } from "@/sanity/queries/gallery";
import MicePageClient from "./page.client";

export const generateMetadata = () => ({
  title: "Expert MICE Services & Corporate Event Planning | Citius",
  description:
    "Citius specializes in planning and executing flawless Meetings, Incentives, Conferences, and Exhibitions (MICE) worldwide. Contact us for a proposal.",
});

export default async function MicePage() {
  const data = await client.fetch(
    GALLERY_DOCUMENT_QUERY,
    {},
    sanityFetchOptions.gallery,
  );
  return <MicePageClient images={data?.images || []} />;
}

