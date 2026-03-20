import { notFound } from "next/navigation";
import { groq } from "next-sanity";
import { client } from "@/sanity/client";
import { getTrailBySlug, getTrailSlugsForStaticParams } from "@/data/trails";
import PilgrimageTrailPageClient from "./page.client";

const RELATED_BLOGS = groq`*[_type == "post" && slug.current in $slugs]{
  "slug": slug.current,
  title
}`;

const fetchOptions = { next: { revalidate: 30 } };

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

  return <PilgrimageTrailPageClient trail={trail} relatedBlogPosts={relatedBlogPosts || []} />;
}
