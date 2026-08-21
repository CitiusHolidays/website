import { notFound } from "next/navigation";
import { Suspense } from "react";
import { cachedSanityFetch } from "@/sanity/cachedFetch";
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
  const post = await cachedSanityFetch(POST_QUERY, { slug }, ["blog"]);

  if (!post) {
    return {
      title: "Post Not Found | Citius Holidays",
    };
  }

  const imageUrl = post.mainImage ? urlFor(post.mainImage).width(1200).height(630).url() : null;
  const excerpt = post.excerpt || (post.body?.[0]?.children?.[0]?.text || "").slice(0, 160);

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
    <Suspense fallback={<BlogPostLoadingShell />}>
      <PostContent params={params} />
    </Suspense>
  );
}

function BlogPostLoadingShell() {
  return (
    <section
      aria-label="Loading article"
      className="min-h-screen animate-pulse bg-public-paper motion-reduce:animate-none"
      role="status"
    >
      <div className="bg-public-night px-4 pt-32 pb-24 sm:px-6 lg:px-8 lg:pt-40 lg:pb-32">
        <div className="mx-auto max-w-7xl">
          <div className="h-11 w-36 rounded-full bg-white/10" />
          <div className="mt-12 h-12 max-w-4xl rounded-xl bg-white/10 md:h-16" />
          <div className="mt-4 h-12 max-w-2xl rounded-xl bg-white/10 md:h-16" />
          <div className="mt-8 h-5 w-48 rounded bg-white/10" />
        </div>
      </div>
      <div className="relative z-10 mx-auto -mt-12 max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="public-media-edge aspect-video bg-public-surface" />
      </div>
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="h-5 w-44 rounded bg-public-blue/10" />
        <div className="h-4 w-full rounded bg-public-blue/10" />
        <div className="h-4 w-full rounded bg-public-blue/10" />
        <div className="h-4 w-5/6 rounded bg-public-blue/10" />
      </div>
    </section>
  );
}

async function PostContent({ params }) {
  const { slug } = await params;
  const post = await cachedSanityFetch(POST_QUERY, { slug }, ["blog"]);

  if (!post) {
    notFound();
  }

  return <PostPageClient post={post} />;
}
