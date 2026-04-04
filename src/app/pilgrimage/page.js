import { client } from "@/sanity/client";
import { getTrailsForHub } from "@/data/trails";
import PilgrimagePageClient from "./page.client";

export const generateMetadata = () => ({
  title: "Spiritual Trails - Kailash Mansarovar Yatra | Citius Travel",
  description:
    "Begin your journey with the Sacred Mansarovar Yatra. Citius Spiritual Trails offers curated pilgrimage experiences for solace, divine connection, and inner transformation.",
});

const IMAGE_ASSET = `asset->{
    _id,
    url
  },
  alt`;

const GALLERY_QUERY = `{
  "perTrail": *[_type == "spiritualTrailGallery"]{
    trailSlug,
    images[]{
      ${IMAGE_ASSET}
    }
  },
  "legacy": *[_type == "spiritualtrails"][0]{
    images[]{
      ${IMAGE_ASSET}
    }
  }.images
}`;

const options = { next: { revalidate: 30 } };

function dedupeImagesByAssetId(items) {
  const seen = new Set();
  return (items || []).filter((item) => {
    const id = item?.asset?._id;
    if (!id) return false;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function mergeSpiritualTrailImages(data) {
  const slugOrder = getTrailsForHub().map((t) => t.slug);
  const rank = (slug) => {
    const i = slugOrder.indexOf(slug);
    return i === -1 ? slugOrder.length : i;
  };

  const docs = [...(data?.perTrail || [])].sort(
    (a, b) => rank(a?.trailSlug) - rank(b?.trailSlug)
  );
  const fromTrails = docs.flatMap((doc) => doc?.images?.filter(Boolean) || []);
  const legacy = data?.legacy?.filter(Boolean) || [];
  return dedupeImagesByAssetId([...fromTrails, ...legacy]);
}

export default async function PilgrimagePage() {
  const data = await client.fetch(GALLERY_QUERY, {}, options);
  const images = mergeSpiritualTrailImages(data);
  return <PilgrimagePageClient images={images} />;
}
