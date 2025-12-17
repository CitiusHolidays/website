import { client } from "@/sanity/client";
import PilgrimagePageClient from "./page.client";

export const generateMetadata = () => ({
  title: "Spiritual Trails - Kailash Mansarovar Yatra | Citius Travel",
  description:
    "Begin your journey with the Sacred Mansarovar Yatra. Citius Spiritual Trails offers curated pilgrimage experiences for solace, divine connection, and inner transformation.",
});

const GALLERY_QUERY = `*[_type == "spiritualtrails"][0]{
  images[]{
    asset->{
      _id,
      url
    },
    alt
  }
}`;

const options = { next: { revalidate: 30 } };

export default async function PilgrimagePage() {
  const data = await client.fetch(GALLERY_QUERY, {}, options);
  return <PilgrimagePageClient images={data?.images || []} />;
}
