import { describe, expect, test } from "bun:test";
import { type BlogPostSummary, blogPageFromPosts, parseBlogCursor } from "./blog";

const DATE = "2026-08-02T18:25:00.000Z";
const rows = Array.from(
  { length: 13 },
  (_, index): BlogPostSummary => ({
    _id: `post-${index}`,
    publishedAt: DATE,
    slug: { current: `story-${index}` },
    sortAt: DATE,
    title: `Story ${index}`,
  })
);

describe("Journal continuation", () => {
  test("keeps the thirteenth result as lookahead and includes both ordering values in the cursor", () => {
    const page = blogPageFromPosts(rows);
    expect(page.posts).toEqual(rows.slice(0, 12));
    expect(parseBlogCursor(page.nextCursor)).toEqual({ afterDate: DATE, afterId: "post-11" });
    expect(blogPageFromPosts(rows.slice(12))).toEqual({ nextCursor: null, posts: [rows[12]] });
    expect(blogPageFromPosts([])).toEqual({ nextCursor: null, posts: [] });
    expect(blogPageFromPosts(rows.slice(0, 12)).nextCursor).toBeNull();
  });

  test("normalizes Sanity timestamp precision while retaining the boundary ID", () => {
    const page = blogPageFromPosts(
      rows.map((post) => ({ ...post, sortAt: "2026-08-02T18:25:00Z" }))
    );
    expect(parseBlogCursor(page.nextCursor)).toEqual({ afterDate: DATE, afterId: "post-11" });
    expect(parseBlogCursor(null)).toEqual({ afterDate: null, afterId: null });
  });

  test.each([
    "",
    "not-json",
    "null",
    "{}",
    '["2026-02-30T00:00:00.000Z","post-1"]',
    '["2026-08-02T18:25:00.000Z","post-1",123]',
    '["2026-08-02T18:25:00.000Z","../post"]',
    '[0,"post-1"]',
    "a".repeat(257),
  ])("rejects malformed or unbounded cursor %s", (value) => {
    expect(() => parseBlogCursor(value)).toThrow();
  });
});
