import type { JsonValue } from "@/lib/jsonValue";
import { isRuntimeString } from "@/lib/runtimeValues";
import type { BlogPostSummary } from "@/sanity/queries/blog";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))?$/;
const TITLE_PUNCTUATION = /[^\p{L}\p{N}]/gu;
const PARTIAL_LAST_WORD = /\s+\S*$/;
const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
  year: "numeric",
});

// These existing covers were reviewed individually. Other current cover assets
// are headline posters; keep those stories text-led until clean media is reviewed.
const REVIEWED_COVERS = new Map([
  [
    "image-6c9a1a786a8059b9957c042c4c47b0ebb703d892-3200x1524-jpg",
    "Rocky coastline and a sheltered bay in Malta",
  ],
  [
    "image-ff66f0c6b26135f715bf63693ed9784d491ee5cd-1920x1080-png",
    "Hands holding an Indian passport in front of a globe",
  ],
]);

export function blogCoverAlt(post: Pick<BlogPostSummary, "mainImage">) {
  return REVIEWED_COVERS.get(post.mainImage?.asset?._ref ?? "") ?? null;
}

export function blogDate(value: JsonValue) {
  if (!(isRuntimeString(value) && ISO_DATE.test(value)) || Number.isNaN(Date.parse(value))) {
    return null;
  }
  const day = String(value).slice(0, 10);
  const date = new Date(day);
  if (date.toISOString().slice(0, 10) !== day) {
    return null;
  }
  return { dateTime: value, label: DATE_FORMAT.format(date) };
}

export function blogExcerpt(post: Pick<BlogPostSummary, "title" | "excerpt" | "opening">) {
  const title = post.title.toLowerCase().replace(TITLE_PUNCTUATION, "");
  const text = [post.excerpt, ...(post.opening ?? []).map((block) => block.text)].find(
    (candidate) =>
      candidate?.trim() && candidate.toLowerCase().replace(TITLE_PUNCTUATION, "") !== title
  );
  if (!text) {
    return null;
  }
  return text.length > 220 ? `${text.slice(0, 220).replace(PARTIAL_LAST_WORD, "")}…` : text;
}
