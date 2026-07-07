import { notFound } from "next/navigation";
import { Suspense } from "react";
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
    alternates: {
      canonical: `https://www.citiusholidays.com/blog/${slug}`,
    },
    authors: [{ name: post.author?.name || "Citius Holidays" }],
    description: excerpt,
    keywords: post.categories?.map((cat) => cat.title).join(", "),
    openGraph: {
      authors: [post.author?.name || "Citius Holidays"],
      description: excerpt,
      images: imageUrl
        ? [
            {
              alt: post.title,
              height: 630,
              url: imageUrl,
              width: 1200,
            },
          ]
        : [],
      locale: "en_US",
      modifiedTime: post._updatedAt,
      publishedTime: post.publishedAt,
      siteName: "Citius Holidays",
      tags: post.categories?.map((cat) => cat.title),
      title: post.title,
      type: "article",
      url: `https://www.citiusholidays.com/blog/${slug}`,
    },
    title: `${post.title} | Citius Holidays Blog`,
    twitter: {
      card: "summary_large_image",
      description: excerpt,
      images: imageUrl ? [imageUrl] : [],
      title: post.title,
    },
  };
}

export default function PostPage({ params }) {
  return (
    <Suspense fallback={null}>
      <PostContent params={params} />
    </Suspense>
  );
}

async function PostContent({ params }) {
  const { slug } = await params;
  const post = await client.fetch(POST_QUERY, { slug }, sanityFetchOptions.blogPost);

  if (!post) {
    notFound();
  }

  return <PostPageClient post={post} />;
}
