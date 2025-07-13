import { client } from "@/sanity/client";
import GalleryPageClient from "./page.client";

export const generateMetadata = () => ({
  title: "Gallery | Citius Experiences",
  description:
    "Browse memorable moments and events curated by Citius across the globe.",
});

const GALLERY_QUERY = `*[_type == "gallery"][0]{
  images[]{
    asset->{
      _id,
      url
    },
    alt
  }
}`;

const options = { next: { revalidate: 30 } };

export default async function GalleryPage() {
  const data = await client.fetch(GALLERY_QUERY, {}, options);
  return <GalleryPageClient images={data?.images || []} />;
}
