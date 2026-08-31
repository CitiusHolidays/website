import { notFound } from "next/navigation";
import { Suspense } from "react";
import PublicRouteLoadingShell from "@/components/layout/PublicRouteLoadingShell";
import { getTrailBySlug, getTrailSlugsForStaticParams } from "@/data/trails";
import { cachedSanityFetch } from "@/sanity/cachedFetch";
import PilgrimageTrailPageClient from "./page.client";

const RELATED_BLOGS = `*[_type == "post" && slug.current in $slugs]{
  "slug": slug.current,
  title
}`;

const TRAIL_CMS_GALLERY = `*[_type == "spiritualTrailGallery" && trailSlug == $slug][0]{
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
      "Citius Spiritual Trails — Kailash Mansarovar yatra and aerial darshan programmes.",
    title: `${trail.title} | Spiritual Trails | Citius Holidays`,
  };
}

export default function PilgrimageTrailPage({ params }) {
  return (
    <Suspense
      fallback={
        <PublicRouteLoadingShell
          description="Route details, dates, inclusions, and booking information for this Citius Spiritual Trail."
          title="Spiritual Trail"
          tone="dark"
        />
      }
    >
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

  const relatedBlogPostsPromise = trail.relatedBlogSlugs?.length
    ? cachedSanityFetch(RELATED_BLOGS, { slugs: trail.relatedBlogSlugs }, ["blog", "spiritual"])
    : Promise.resolve([]);
  // The gallery and related posts are independent Sanity reads. Resolve them together so a
  // trail page is not gated by two serial network round trips.
  const [relatedBlogPosts, cmsDoc] = await Promise.all([
    relatedBlogPostsPromise,
    cachedSanityFetch(TRAIL_CMS_GALLERY, { slug }, ["spiritual"]),
  ]);
  const cmsGallery = normalizeCmsGalleryRows(cmsDoc?.images);
  const gallery = mergeTrailGalleries(cmsGallery, trail.gallery);
  const trailWithGallery = { ...trail, gallery };

  return (
    <PilgrimageTrailPageClient relatedBlogPosts={relatedBlogPosts || []} trail={trailWithGallery} />
  );
}
