import { cachedSanityFetch } from "@/sanity/cachedFetch";
import { BLOG_POSTS_QUERY, blogPageFromPosts, parseBlogCursor } from "@/sanity/queries/blog";

export async function GET(request: Request) {
  return await withApiRequestLogging(request, "/api/blog", async () => {
    let params: ReturnType<typeof parseBlogCursor>;
    try {
      params = parseBlogCursor(new URL(request.url).searchParams.get("after"));
    } catch {
      return Response.json({ message: "Invalid journal cursor" }, { status: 400 });
    }

    try {
      const rows = await cachedSanityFetch(BLOG_POSTS_QUERY, params, ["blog"]);
      return Response.json(blogPageFromPosts(rows));
    } catch {
      return Response.json({ message: "Stories could not be loaded" }, { status: 502 });
    }
  });
}

import { withApiRequestLogging } from "@/lib/observability/api-log";
