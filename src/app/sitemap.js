import { groq } from "next-sanity";
import { getTrailSlugsForStaticParams } from "@/data/trails";
import { cachedSanityFetch } from "@/sanity/cachedFetch";

export default async function sitemap() {
  const baseUrl = "https://www.citiusholidays.com";

  // Get all posts
  const postsQuery = groq`*[_type == "post" && defined(slug.current)]{
    "slug": slug.current,
    _updatedAt
  }`;
  const posts = await cachedSanityFetch(postsQuery, {}, ["blog"]);

  const postUrls = posts.map((post) => ({
    changeFrequency: "daily",
    lastModified: post._updatedAt,
    priority: 0.5,
    url: `${baseUrl}/blog/${post.slug}`,
  }));

  const spiritualTrailUrls = getTrailSlugsForStaticParams().map(({ slug }) => ({
    changeFrequency: "monthly",
    lastModified: new Date(),
    priority: 0.55,
    url: `${baseUrl}/pilgrimage/${slug}`,
  }));

  const staticUrls = [
    {
      changeFrequency: "yearly",
      lastModified: new Date(),
      priority: 1,
      url: baseUrl,
    },
    {
      changeFrequency: "monthly",
      lastModified: new Date(),
      priority: 0.5,
      url: `${baseUrl}/about`,
    },
    {
      changeFrequency: "monthly",
      lastModified: new Date(),
      priority: 0.5,
      url: `${baseUrl}/account`,
    },
    {
      changeFrequency: "monthly",
      lastModified: new Date(),
      priority: 0.5,
      url: `${baseUrl}/contact`,
    },
    {
      changeFrequency: "monthly",
      lastModified: new Date(),
      priority: 0.5,
      url: `${baseUrl}/gallery`,
    },
    {
      changeFrequency: "monthly",
      lastModified: new Date(),
      priority: 0.5,
      url: `${baseUrl}/mice`,
    },
    {
      changeFrequency: "monthly",
      lastModified: new Date(),
      priority: 0.5,
      url: `${baseUrl}/pilgrimage`,
    },
    {
      changeFrequency: "monthly",
      lastModified: new Date(),
      priority: 0.3,
      url: `${baseUrl}/policies`,
    },
    {
      changeFrequency: "monthly",
      lastModified: new Date(),
      priority: 0.5,
      url: `${baseUrl}/services`,
    },
  ];

  return [...staticUrls, ...spiritualTrailUrls, ...postUrls];
}
