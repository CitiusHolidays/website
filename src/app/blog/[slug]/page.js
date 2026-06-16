import { notFound } from "next/navigation";
import { client } from "@/sanity/client";
import { sanityFetchOptions } from "@/sanity/fetchOptions";
import { urlFor } from "@/sanity/imageUrl";
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
  excerpt,
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

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const post = await client.fetch(POST_QUERY, { slug }, sanityFetchOptions.blogPost);

  if (!post) {
    return {
      title: "Post Not Found | Citius Holidays",
    };
  }

  const imageUrl = post.mainImage ? urlFor(post.mainImage).width(1200).height(630).url() : null;
  const excerpt = post.excerpt || (post.body?.[0]?.children?.[0]?.text || "").substring(0, 160);

  return {
    title: `${post.title} | Citius Holidays Blog`,
    description: excerpt,
    keywords: post.categories?.map((cat) => cat.title).join(", "),
    authors: [{ name: post.author?.name || "Citius Holidays" }],
    openGraph: {
      title: post.title,
      description: excerpt,
      url: `https://www.citiusholidays.com/blog/${slug}`,
      siteName: "Citius Holidays",
      images: imageUrl
        ? [
            {
              url: imageUrl,
              width: 1200,
              height: 630,
              alt: post.title,
            },
          ]
        : [],
      locale: "en_US",
      type: "article",
      publishedTime: post.publishedAt,
      modifiedTime: post._updatedAt,
      authors: [post.author?.name || "Citius Holidays"],
      tags: post.categories?.map((cat) => cat.title),
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: excerpt,
      images: imageUrl ? [imageUrl] : [],
    },
    alternates: {
      canonical: `https://www.citiusholidays.com/blog/${slug}`,
    },
  };
}

export default async function PostPage({ params }) {
  const { slug } = await params;
  const post = await client.fetch(POST_QUERY, { slug }, sanityFetchOptions.blogPost);

  if (!post) {
    notFound();
  }

  return <PostPageClient post={post} />;
}
