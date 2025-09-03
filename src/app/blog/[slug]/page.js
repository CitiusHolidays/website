import { client } from "@/sanity/client";
import PostPageClient from "./page.client";
import { notFound } from "next/navigation";
import imageUrlBuilder from "@sanity/image-url";

const { projectId, dataset } = client.config();
const urlFor = (source) =>
  projectId && dataset
    ? imageUrlBuilder({ projectId, dataset }).image(source)
    : null;

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

const options = { next: { revalidate: 30 } };

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const post = await client.fetch(POST_QUERY, { slug }, options);

  if (!post) {
    return {
      title: 'Post Not Found | Citius Travel'
    };
  }

  const imageUrl = post.mainImage ? urlFor(post.mainImage).width(1200).height(630).url() : null;
  const excerpt = post.excerpt || (post.body?.[0]?.children?.[0]?.text || '').substring(0, 160);

  return {
    title: `${post.title} | Citius Travel Blog`,
    description: excerpt,
    keywords: post.categories?.map(cat => cat.title).join(', '),
    authors: [{ name: post.author?.name || 'Citius Travel' }],
    openGraph: {
      title: post.title,
      description: excerpt,
      url: `https://www.citiusholidays.com/blog/${slug}`,
      siteName: 'Citius Travel',
      images: imageUrl ? [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: post.title,
        }
      ] : [],
      locale: 'en_US',
      type: 'article',
      publishedTime: post.publishedAt,
      modifiedTime: post._updatedAt,
      authors: [post.author?.name || 'Citius Travel'],
      tags: post.categories?.map(cat => cat.title),
    },
    twitter: {
      card: 'summary_large_image',
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
  const post = await client.fetch(POST_QUERY, { slug }, options);

  if (!post) {
    notFound();
  }

  return <PostPageClient post={post} />;
}
