/** Next.js cache options for Sanity `client.fetch` (next-sanity). */
export const sanityFetchOptions = {
  gallery: {
    next: { revalidate: 300, tags: ["gallery"] },
  },
  blogIndex: {
    next: { revalidate: 300, tags: ["blog"] },
  },
  blogPost: {
    next: { revalidate: 300, tags: ["blog"] },
  },
  spiritual: {
    next: { revalidate: 300, tags: ["spiritual"] },
  },
  sitemap: {
    next: { revalidate: 300, tags: ["blog"] },
  },
};
