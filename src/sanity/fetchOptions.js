/** Next.js cache options for Sanity `client.fetch` (next-sanity). */
export const sanityFetchOptions = {
  blogIndex: {
    next: { revalidate: 300, tags: ["blog"] },
  },
  blogPost: {
    next: { revalidate: 300, tags: ["blog"] },
  },
  gallery: {
    next: { revalidate: 300, tags: ["gallery"] },
  },
  sitemap: {
    next: { revalidate: 300, tags: ["blog"] },
  },
  spiritual: {
    next: { revalidate: 300, tags: ["spiritual"] },
  },
};
