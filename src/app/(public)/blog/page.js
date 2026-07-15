import { cachedSanityFetch } from "@/sanity/cachedFetch";
import BlogPageClient from "./page.client";

const POSTS_QUERY = `*[
   _type == "post"
   && defined(slug.current)
]|order(publishedAt desc)[0...12]{_id, title, slug, publishedAt, mainImage}`;

export const metadata = {
  description: "Travel insights, pilgrimage guides, and stories from Citius Holidays.",
  title: "Blog",
};

export default async function IndexPage() {
  const posts = await cachedSanityFetch(POSTS_QUERY, {}, ["blog"]);

  return <BlogPageClient posts={posts} />;
}
