import { client } from "@/sanity/client";
import MicePageClient from "./page.client";

export const generateMetadata = () => ({
  title: "Expert MICE Services & Corporate Event Planning | Citius",
  description:
    "Citius specializes in planning and executing flawless Meetings, Incentives, Conferences, and Exhibitions (MICE) worldwide. Contact us for a proposal.",
});

const MICE_QUERY = `*[_type == "gallery"][0]{
  images[]{
    asset->{
      _id,
      url
    },
    alt
  }
}`;

const options = { next: { revalidate: 30 } };

export default async function MicePage() {
  const data = await client.fetch(MICE_QUERY, {}, options);
  return <MicePageClient images={data?.images || []} />;
}

