import { notFound } from "next/navigation";
import { groq } from "next-sanity";
import { client } from "@/sanity/client";
import { getTrailBySlug, getTrailSlugsForStaticParams } from "@/data/trails";
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
  return rows
    .map((row) => ({
      src: row?.asset?.url || "",
      alt: row?.alt || ""
    }))
    .filter((row) => row.src);
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
    return { title: "Trail | Citius Travel" };
  }
  return {
    title: `${trail.title} | Spiritual Trails | Citius Travel`,
    description: trail.subtitle || trail.positioning || "Citius Spiritual Trails — curated Kailash Mansarovar journeys."
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
      fetchOptions
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
