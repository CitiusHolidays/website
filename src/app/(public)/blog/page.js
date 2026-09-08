import { cachedSanityFetch } from "@/sanity/cachedFetch";
import { BLOG_POSTS_QUERY, blogPageFromPosts, parseBlogCursor } from "@/sanity/queries/blog";
import BlogPageClient from "./page.client";

export const metadata = {
  description: "Travel insights, pilgrimage guides, and stories from Citius Holidays.",
  title: "Blog",
};

export default async function IndexPage() {
  const posts = await cachedSanityFetch(BLOG_POSTS_QUERY, parseBlogCursor(null), ["blog"]);
  return <BlogPageClient initialPage={blogPageFromPosts(posts)} />;
}
