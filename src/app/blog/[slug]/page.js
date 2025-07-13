import { client } from "@/sanity/client";
import PostPageClient from "./page.client";

const POST_QUERY = `*[_type == "post" && slug.current == $slug][0]{
  _id,
  _createdAt,
  _updatedAt,
  title,
  slug,
  publishedAt,
  mainImage,
  body,
  author->{
    _id,
    name,
    slug,
    image,
    bio
  },
  categories[]->{
    _id,
    title,
    description
  }
}`;

const options = { next: { revalidate: 30 } };

export default async function PostPage({ params }) {
  const resolvedParams = await params;
  const post = await client.fetch(POST_QUERY, resolvedParams, options);
  return <PostPageClient post={post} />;
}
