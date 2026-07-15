import { cacheLife, cacheTag } from "next/cache";
import { client } from "@/sanity/client";

export const SANITY_PUBLIC_CACHE_POLICY = Object.freeze({
  expire: 60 * 60,
  revalidate: 5 * 60,
  stale: 5 * 60,
});

/**
 * Cache public CMS content only. Request-derived values and authenticated data
 * must never be passed through this boundary.
 */
export async function cachedSanityFetch(query, params = {}, tags = []) {
  "use cache";

  cacheLife(SANITY_PUBLIC_CACHE_POLICY);
  if (tags.length > 0) {
    cacheTag(...tags);
  }

  return await client.fetch(query, params);
}
