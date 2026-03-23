import { client } from "@/sanity/client";
import { sanityFetchOptions } from "@/sanity/fetchOptions";
import BlogPageClient from "./page.client";

const POSTS_QUERY = `*[
   _type == "post"
   && defined(slug.current)
]|order(publishedAt desc)[0...12]{_id, title, slug, publishedAt, mainImage}`;

export default async function IndexPage() {
  const posts = await client.fetch(
    POSTS_QUERY,
    {},
    sanityFetchOptions.blogIndex,
  );

  return <BlogPageClient posts={posts} />;
}
