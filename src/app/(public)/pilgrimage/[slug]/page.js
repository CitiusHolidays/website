import { notFound } from "next/navigation";
import { groq } from "next-sanity";
import { Suspense } from "react";
import { getTrailBySlug, getTrailSlugsForStaticParams } from "@/data/trails";
import { cachedSanityFetch } from "@/sanity/cachedFetch";
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

function normalizeCmsGalleryRows(rows) {
  if (!rows?.length) {
    return [];
  }
  return rows.reduce((items, row) => {
    const src = row?.asset?.url || "";
    if (src) {
      items.push({
        alt: row?.alt || "",
        src,
      });
    }
    return items;
  }, []);
}

function mergeTrailGalleries(cms, staticGallery) {
  const seen = new Set();
  const out = [];
  for (const img of [...cms, ...(staticGallery || [])]) {
    if (!img?.src) {
      continue;
    }
    if (seen.has(img.src)) {
      continue;
    }
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
    description:
      trail.subtitle ||
      trail.positioning ||
      "Citius Spiritual Trails — curated Kailash Mansarovar journeys.",
    title: `${trail.title} | Spiritual Trails | Citius Holidays`,
  };
}

export default function PilgrimageTrailPage({ params }) {
  return (
    <Suspense fallback={null}>
      <PilgrimageTrailContent params={params} />
    </Suspense>
  );
}

async function PilgrimageTrailContent({ params }) {
  const { slug } = await params;
  const trail = getTrailBySlug(slug);
  if (!trail) {
    notFound();
  }

  let relatedBlogPosts = [];
  if (trail.relatedBlogSlugs?.length) {
    relatedBlogPosts = await cachedSanityFetch(RELATED_BLOGS, { slugs: trail.relatedBlogSlugs }, [
      "blog",
      "spiritual",
    ]);
  }

  const cmsDoc = await cachedSanityFetch(TRAIL_CMS_GALLERY, { slug }, ["spiritual"]);
  const cmsGallery = normalizeCmsGalleryRows(cmsDoc?.images);
  const gallery = mergeTrailGalleries(cmsGallery, trail.gallery);
  const trailWithGallery = { ...trail, gallery };

  return (
    <PilgrimageTrailPageClient relatedBlogPosts={relatedBlogPosts || []} trail={trailWithGallery} />
  );
}
