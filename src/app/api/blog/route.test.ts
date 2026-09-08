import { beforeEach, expect, mock, test } from "bun:test";
import { BLOG_POSTS_QUERY } from "@/sanity/queries/blog";

const fetchPosts = mock();
mock.module("@/sanity/cachedFetch", () => ({ cachedSanityFetch: fetchPosts }));
const { GET } = await import("./route");

beforeEach(() => fetchPosts.mockReset());

test("continuation validates its public cursor before querying and returns bounded content", async () => {
  const date = "2026-08-02T00:00:00.000Z";
  const cursor = JSON.stringify([date, "post-11"]);
  fetchPosts.mockResolvedValue([{ _id: "post-12", sortAt: date, title: "A story" }]);
  const response = await GET(
    new Request(`https://citiusholidays.com/api/blog?after=${encodeURIComponent(cursor)}`)
  );
  expect(response.status).toBe(200);
  expect(fetchPosts).toHaveBeenCalledWith(
    BLOG_POSTS_QUERY,
    { afterDate: date, afterId: "post-11" },
    ["blog"]
  );
  expect(await response.json()).toEqual({
    nextCursor: null,
    posts: [{ _id: "post-12", sortAt: date, title: "A story" }],
  });
});

test("bad cursors make no CMS call; CMS failure has a safe retry response", async () => {
  const invalid = await GET(new Request("https://citiusholidays.com/api/blog?after=invalid"));
  expect(invalid.status).toBe(400);
  expect(fetchPosts).not.toHaveBeenCalled();
  fetchPosts.mockRejectedValue(new Error("private upstream diagnostics"));
  const failed = await GET(new Request("https://citiusholidays.com/api/blog"));
  expect(failed.status).toBe(502);
  expect(await failed.text()).not.toContain("private upstream diagnostics");
});
