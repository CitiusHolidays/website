import type { JsonValue } from "@/lib/jsonValue";
import { isRuntimeString } from "@/lib/runtimeValues";

const BLOG_PAGE_SIZE = 12;

export interface BlogPostSummary {
  _id: string;
  excerpt?: string | null;
  mainImage?: { asset?: { _ref?: string }; alt?: string } | null;
  opening?: { text: string }[];
  publishedAt: string | null;
  slug: { current: string };
  sortAt: string;
  title: string;
}

export interface BlogPage {
  nextCursor: string | null;
  posts: BlogPostSummary[];
}

// Creation time orders undated posts; it is never presented as a publication date.
// The ID tie-breaker is also part of the cursor, so equal dates cannot skip stories.
export const BLOG_POSTS_QUERY = `*[
  _type == "post" && defined(slug.current) && !(_id in path("drafts.**"))
  && (
    $afterDate == null
    || coalesce(dateTime(publishedAt), dateTime(_createdAt)) < dateTime($afterDate)
    || (coalesce(dateTime(publishedAt), dateTime(_createdAt)) == dateTime($afterDate) && _id > $afterId)
  )
]|order(coalesce(dateTime(publishedAt), dateTime(_createdAt)) desc, _id asc)[0...${BLOG_PAGE_SIZE + 1}]{
  _id, title, slug, publishedAt, mainImage, excerpt,
  "sortAt": string(coalesce(dateTime(publishedAt), dateTime(_createdAt))),
  "opening": body[_type == "block" && style == "normal"][0...3]{
    "text": array::join(children[].text, "")
  }
}`;

const DOCUMENT_ID = /^[a-zA-Z0-9_.-]{1,128}$/;

export function parseBlogCursor(cursor: string | null) {
  if (cursor === null) {
    return { afterDate: null, afterId: null };
  }
  if (cursor.length > 256) {
    throw new Error("Invalid journal cursor");
  }
  const value: JsonValue = JSON.parse(cursor);
  if (
    !Array.isArray(value) ||
    value.length !== 2 ||
    !isRuntimeString(value[0]) ||
    !isRuntimeString(value[1]) ||
    !DOCUMENT_ID.test(value[1]) ||
    Number.isNaN(Date.parse(value[0])) ||
    new Date(value[0]).toISOString() !== value[0]
  ) {
    throw new Error("Invalid journal cursor");
  }
  return { afterDate: value[0], afterId: value[1] };
}

export function blogPageFromPosts(rows: BlogPostSummary[]): BlogPage {
  const posts = rows.slice(0, BLOG_PAGE_SIZE);
  const last = posts.at(-1);
  return {
    nextCursor:
      rows.length > BLOG_PAGE_SIZE && last
        ? JSON.stringify([new Date(last.sortAt).toISOString(), last._id])
        : null,
    posts,
  };
}
