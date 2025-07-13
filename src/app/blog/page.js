import { client } from "@/sanity/client";
import BlogPageClient from "./page.client";

const POSTS_QUERY = `*[
   _type == "post"
   && defined(slug.current)
]|order(publishedAt desc)[0...12]{_id, title, slug, publishedAt, mainImage}`;

const options = { next: { revalidate: 30 } };

export default async function IndexPage() {
  const posts = await client.fetch(POSTS_QUERY, {}, options);

  return <BlogPageClient posts={posts} />;
}
