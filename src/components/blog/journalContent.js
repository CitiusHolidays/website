import { isRuntimeString } from "@/lib/runtimeValues";
import { urlFor } from "@/sanity/imageUrl";

/** Pure content helpers for the Citius Journal. Safe in server and client modules. */

/** CMS text as a trimmed string; anything that is not text becomes "". */
export function cleanText(value) {
  return isRuntimeString(value) ? value.trim() : "";
}

export const JOURNAL_NAME = "Citius Journal";
const JOURNAL_PATH = "/blog";
export const SITE_URL = "https://www.citiusholidays.com";
const JOURNAL_CONTENTS_LIMIT = 12;

const WORDS_PER_MINUTE = 220;
const UPDATE_THRESHOLD_MS = 24 * 60 * 60 * 1000;
const WHITESPACE_PATTERN = /\s+/;
const ASSET_DIMENSIONS_PATTERN = /-(\d+)x(\d+)-[a-z0-9]+$/i;
const TRAILING_PUNCTUATION_PATTERN = /[\s,;:.!?-]+$/;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const journalDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  timeZone: "Asia/Kolkata",
  year: "numeric",
});

/** "12 March 2026", in India time; null for empty or unparseable input. */
export function formatJournalDate(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return journalDateFormatter.format(parsed);
}

/** Calendar day in India time, used to decide whether an update is worth showing. */
function indiaDayKey(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

/** The date a story is presented under: its published date, else its creation date. */
export function getJournalDate(post) {
  return post?.publishedAt || post?._createdAt || null;
}

/** An "Updated" date only when the story changed on a later day than it was dated. */
export function getJournalUpdatedDate(post) {
  const dated = getJournalDate(post);
  const updated = post?._updatedAt;
  if (!(dated && updated)) {
    return null;
  }
  const datedDay = indiaDayKey(dated);
  const updatedDay = indiaDayKey(updated);
  if (!(datedDay && updatedDay) || updatedDay <= datedDay) {
    return null;
  }
  // Edits within a day of publishing are corrections, not news for the reader.
  if (new Date(updated).getTime() - new Date(dated).getTime() < UPDATE_THRESHOLD_MS) {
    return null;
  }
  return updated;
}

/** Plain text of one Portable Text block (empty for images and other objects). */
function blockToPlainText(block) {
  if (block?._type !== "block" || !Array.isArray(block.children)) {
    return "";
  }
  return block.children.map((child) => (isRuntimeString(child?.text) ? child.text : "")).join("");
}

function portableTextToPlainText(blocks) {
  if (!Array.isArray(blocks)) {
    return "";
  }
  const texts = [];
  for (const block of blocks) {
    const text = blockToPlainText(block);
    if (text.trim().length > 0) {
      texts.push(text);
    }
  }
  return texts.join("\n\n");
}

function countWords(text) {
  const trimmed = String(text ?? "").trim();
  return trimmed ? trimmed.split(WHITESPACE_PATTERN).length : 0;
}

/** Reading time from the words in the body, at 220 words a minute, never below one minute. */
export function getReadingMinutes(blocks) {
  return readingMinutesFromWords(countWords(portableTextToPlainText(blocks)));
}

/** Reading time from a precomputed word count (for list queries that do not fetch the body). */
export function readingMinutesFromWords(words) {
  const count = Number(words);
  return Math.max(1, Math.round((Number.isFinite(count) ? count : 0) / WORDS_PER_MINUTE));
}

export function formatReadingTime(minutes) {
  return `${minutes} min read`;
}

/**
 * Drop an opening heading that only repeats the story title (imported posts often start with one),
 * so the page does not show the title twice.
 */
export function withoutRepeatedTitle(blocks, title) {
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return [];
  }
  const [first, ...rest] = blocks;
  const isHeading = first?._type === "block" && ["h1", "h2", "h3", "h4"].includes(first.style);
  const target = normalizeForComparison(title);
  if (isHeading && target && normalizeForComparison(blockToPlainText(first)) === target) {
    return rest;
  }
  return blocks;
}

/** Shorten text at a word boundary and close it with an ellipsis. */
function truncateAtWord(text, maxLength) {
  const clean = String(text ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (clean.length <= maxLength) {
    return clean;
  }
  const slice = clean.slice(0, maxLength);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > maxLength * 0.6 ? slice.slice(0, lastSpace) : slice;
  return `${cut.replace(TRAILING_PUNCTUATION_PATTERN, "")}…`;
}

function normalizeForComparison(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

/**
 * The editor's excerpt, else the opening paragraphs shortened at a word boundary. Paragraphs that
 * only repeat the title (common in imported posts) are skipped.
 */
export function getExcerpt(post, maxLength = 180) {
  const written = cleanText(post?.excerpt);
  if (written) {
    return written;
  }
  if (!Array.isArray(post?.body)) {
    return "";
  }
  const title = normalizeForComparison(post.title);
  const parts = [];
  for (const block of post.body) {
    if (block?._type !== "block" || (block.style ?? "normal") !== "normal") {
      continue;
    }
    const text = blockToPlainText(block).trim();
    const normalized = normalizeForComparison(text);
    if (!normalized || (title && (normalized === title || title.includes(normalized)))) {
      continue;
    }
    parts.push(text);
    if (parts.join(" ").length >= maxLength * 0.66) {
      break;
    }
  }
  return parts.length > 0 ? truncateAtWord(parts.join(" "), maxLength) : "";
}

/**
 * Alt text: the editor's alt, else the caption, else the given fallback (usually the post title).
 * The fallbacks apply only when alt is empty.
 */
export function getImageAlt(image, fallback = "") {
  const alt = cleanText(image?.alt);
  if (alt) {
    return alt;
  }
  const caption = cleanText(image?.caption);
  return caption || fallback;
}

/** Pixel size of a Sanity image after the editor's crop, read from the asset reference. */
export function getImageDimensions(image) {
  const ref = image?.asset?._ref ?? image?.asset?._id ?? "";
  const match = ASSET_DIMENSIONS_PATTERN.exec(ref);
  if (!match) {
    return null;
  }
  const width = Number(match[1]);
  const height = Number(match[2]);
  const crop = image.crop ?? {};
  const keepX = 1 - (crop.left ?? 0) - (crop.right ?? 0);
  const keepY = 1 - (crop.top ?? 0) - (crop.bottom ?? 0);
  return {
    height: Math.max(1, Math.round(height * keepY)),
    width: Math.max(1, Math.round(width * keepX)),
  };
}

/**
 * A plate at the image's own (cropped) proportions, so text baked into the artwork is never cut.
 * Returns null when the image or the Sanity project configuration is missing.
 */
export function getPlateImage(image, width = 1600) {
  const dimensions = getImageDimensions(image);
  const builder = image?.asset ? urlFor(image) : null;
  if (!(dimensions && builder)) {
    return null;
  }
  const renderWidth = Math.min(width, dimensions.width);
  return {
    height: Math.round((renderWidth * dimensions.height) / dimensions.width),
    src: builder.width(renderWidth).auto("format").url(),
    width: renderWidth,
  };
}

/** A fixed-size crop that honours the editor's crop and hotspot (social cards, structured data). */
export function getCroppedImageUrl(image, width, height) {
  const builder = image?.asset ? urlFor(image) : null;
  return builder ? builder.width(width).height(height).auto("format").url() : null;
}

/** Lead story, the contents (up to the limit, lead included) and the archive beyond it. */
export function splitJournalIndex(posts, limit = JOURNAL_CONTENTS_LIMIT) {
  const list = Array.isArray(posts) ? posts.filter((post) => post?.slug?.current) : [];
  const [lead = null, ...rest] = list;
  return {
    archive: rest.slice(Math.max(0, limit - 1)),
    contents: rest.slice(0, Math.max(0, limit - 1)),
    lead,
  };
}

/** Group archive posts by year, newest year first, keeping the given order inside each year. */
export function groupPostsByYear(posts) {
  const groups = new Map();
  for (const post of posts ?? []) {
    const date = getJournalDate(post);
    const year = date
      ? new Date(date).toLocaleDateString("en-GB", { timeZone: "Asia/Kolkata", year: "numeric" })
      : "Undated";
    if (!groups.has(year)) {
      groups.set(year, []);
    }
    groups.get(year).push(post);
  }
  return [...groups.entries()].map(([year, items]) => ({ items, year }));
}

/** "Director, Mumbai & Thane office" style line from optional author fields. */
export function getAuthorRoleLine(author) {
  const role = cleanText(author?.role);
  const office = cleanText(author?.office);
  if (role && office) {
    return `${role}, ${office}`;
  }
  return role || (office ? `${office} office` : "");
}

export function isTrailSlug(value) {
  return isRuntimeString(value) && SLUG_PATTERN.test(value);
}

export function journalPostUrl(slug) {
  return `${SITE_URL}${JOURNAL_PATH}/${slug}`;
}

/** schema.org BlogPosting for one story. Absent values are left out rather than invented. */
export function buildBlogPostingJsonLd(post, { imageUrl = null } = {}) {
  const slug = post?.slug?.current;
  const url = slug ? journalPostUrl(slug) : `${SITE_URL}${JOURNAL_PATH}`;
  const datePublished = getJournalDate(post);
  const description = getExcerpt(post, 200);
  const keywords = (post?.categories ?? []).flatMap((category) =>
    category?.title ? [category.title] : []
  );
  const words = countWords(portableTextToPlainText(post?.body));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post?.title,
    isPartOf: { "@type": "Blog", name: JOURNAL_NAME, url: `${SITE_URL}${JOURNAL_PATH}` },
    mainEntityOfPage: { "@id": url, "@type": "WebPage" },
    publisher: {
      "@type": "Organization",
      name: "Citius Holidays",
      url: SITE_URL,
    },
    url,
  };
  if (datePublished) {
    jsonLd.datePublished = datePublished;
  }
  if (post?._updatedAt) {
    jsonLd.dateModified = post._updatedAt;
  }
  if (description) {
    jsonLd.description = description;
  }
  if (imageUrl) {
    jsonLd.image = [imageUrl];
  }
  if (post?.author?.name) {
    const author = { "@type": "Person", name: post.author.name };
    const jobTitle = cleanText(post.author.role);
    if (jobTitle) {
      author.jobTitle = jobTitle;
    }
    author.worksFor = { "@type": "Organization", name: "Citius Holidays" };
    jsonLd.author = author;
  } else {
    jsonLd.author = { "@type": "Organization", name: "Citius Holidays", url: SITE_URL };
  }
  if (keywords.length > 0) {
    jsonLd.keywords = keywords.join(", ");
  }
  if (words > 0) {
    jsonLd.wordCount = words;
  }
  return jsonLd;
}

/** schema.org BreadcrumbList from ordered { name, url } items. */
export function buildBreadcrumbJsonLd(items) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      item: item.url,
      name: item.name,
      position: index + 1,
    })),
  };
}

/** JSON for a <script type="application/ld+json">, with "<" escaped so content cannot close the tag. */
export function serializeJsonLd(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
