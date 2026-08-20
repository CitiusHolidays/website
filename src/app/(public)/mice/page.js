import { cachedSanityFetch } from "@/sanity/cachedFetch";
import { GALLERY_DOCUMENT_QUERY } from "@/sanity/queries/gallery";
import MicePageClient from "./page.client";

export const generateMetadata = () => ({
  description:
    "Citius plans meetings, incentives, conferences, and exhibitions around your brief. Request a proposal from one accountable team.",
  title: "MICE programmes planned around your brief | Citius",
});

export default async function MicePage() {
  const data = await cachedSanityFetch(GALLERY_DOCUMENT_QUERY, {}, ["gallery"]);
  return <MicePageClient images={data?.images || []} />;
}
