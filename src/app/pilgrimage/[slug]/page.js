import { notFound } from "next/navigation";
import { groq } from "next-sanity";
import { getTrailBySlug, getTrailSlugsForStaticParams } from "@/data/trails";
import { client } from "@/sanity/client";
import PilgrimageTrailPageClient from "./page.client";

const RELATED_BLOGS = groq`*[_type == "post" && slug.current in $slugs]{
  "slug": slug.current,
  title
}`;

const TRAIL_CMS_GALLERY = groq`*[_type == "spiritualTrailGallery" && trailSlug == $slug][0]{
  images[]{
    alt,
    asset->{ url }
  }
}`;

const fetchOptions = { next: { revalidate: 30 } };

function normalizeCmsGalleryRows(rows) {
  if (!rows?.length) return [];
  return rows.reduce((items, row) => {
    const src = row?.asset?.url || "";
    if (src) {
      items.push({
        src,
        alt: row?.alt || "",
      });
    }
    return items;
  }, []);
}

function mergeTrailGalleries(cms, staticGallery) {
  const seen = new Set();
  const out = [];
  for (const img of [...cms, ...(staticGallery || [])]) {
    if (!img?.src) continue;
    if (seen.has(img.src)) continue;
    seen.add(img.src);
    out.push(img);
  }
  return out;
}

export function generateStaticParams() {
  return getTrailSlugsForStaticParams();
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const trail = getTrailBySlug(slug);
  if (!trail) {
    return { title: "Trail | Citius Holidays" };
  }
  return {
    title: `${trail.title} | Spiritual Trails | Citius Holidays`,
    description:
      trail.subtitle ||
      trail.positioning ||
      "Citius Spiritual Trails — curated Kailash Mansarovar journeys.",
  };
}

export default async function PilgrimageTrailPage({ params }) {
  const { slug } = await params;
  const trail = getTrailBySlug(slug);
  if (!trail) {
    notFound();
  }

  let relatedBlogPosts = [];
  if (trail.relatedBlogSlugs?.length) {
    relatedBlogPosts = await client.fetch(
      RELATED_BLOGS,
      { slugs: trail.relatedBlogSlugs },
      fetchOptions,
    );
  }

  const cmsDoc = await client.fetch(TRAIL_CMS_GALLERY, { slug }, fetchOptions);
  const cmsGallery = normalizeCmsGalleryRows(cmsDoc?.images);
  const gallery = mergeTrailGalleries(cmsGallery, trail.gallery);
  const trailWithGallery = { ...trail, gallery };

  return (
    <PilgrimageTrailPageClient trail={trailWithGallery} relatedBlogPosts={relatedBlogPosts || []} />
  );
}
