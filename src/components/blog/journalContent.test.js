import { describe, expect, mock, test } from "bun:test";
import { createImageUrlBuilder } from "@sanity/image-url";

mock.module("@/sanity/imageUrl", () => ({
  urlFor: (source) =>
    createImageUrlBuilder({ dataset: "test", projectId: "journal" }).image(source),
}));

const {
  buildBlogPostingJsonLd,
  buildBreadcrumbJsonLd,
  formatJournalDate,
  getAuthorRoleLine,
  getCroppedImageUrl,
  getExcerpt,
  getImageAlt,
  getImageDimensions,
  getJournalDate,
  getJournalUpdatedDate,
  getPlateImage,
  getReadingMinutes,
  groupPostsByYear,
  isTrailSlug,
  readingMinutesFromWords,
  serializeJsonLd,
  splitJournalIndex,
  withoutRepeatedTitle,
} = await import("./journalContent");

const block = (text, style = "normal") => ({
  _type: "block",
  children: [{ _type: "span", text }],
  style,
});
const words = (count) => Array.from({ length: count }, (_, index) => `word${index}`).join(" ");
const IMAGE = {
  _type: "image",
  asset: { _ref: "image-abc123-1920x1080-jpg", _type: "reference" },
  crop: { bottom: 0.02, left: 0.1, right: 0.3, top: 0 },
  hotspot: { height: 0.97, width: 0.58, x: 0.4, y: 0.49 },
};

describe("Journal dates", () => {
  test("Formats dates as day, month name and year in India time", () => {
    expect(formatJournalDate("2026-03-12T06:00:00Z")).toBe("12 March 2026");
    // 20:00 UTC on 1 Aug is already 2 Aug in India.
    expect(formatJournalDate("2026-08-01T20:00:00Z")).toBe("2 August 2026");
  });

  test("Returns null instead of a placeholder for empty or invalid input", () => {
    expect(formatJournalDate(null)).toBeNull();
    expect(formatJournalDate("")).toBeNull();
    expect(formatJournalDate("not a date")).toBeNull();
  });

  test("Falls back to the creation date when a story has no publish date", () => {
    expect(getJournalDate({ _createdAt: "2026-08-30T13:00:02Z", publishedAt: null })).toBe(
      "2026-08-30T13:00:02Z"
    );
    expect(
      getJournalDate({ _createdAt: "2026-08-30T13:00:02Z", publishedAt: "2026-09-01T00:00:00Z" })
    ).toBe("2026-09-01T00:00:00Z");
  });

  test("Shows an update only when it is a day or more after the story's date", () => {
    expect(
      getJournalUpdatedDate({
        _updatedAt: "2026-08-02T18:35:51Z",
        publishedAt: "2026-08-02T18:25:00Z",
      })
    ).toBeNull();
    expect(
      getJournalUpdatedDate({
        _updatedAt: "2026-08-20T10:00:00Z",
        publishedAt: "2026-08-02T18:25:00Z",
      })
    ).toBe("2026-08-20T10:00:00Z");
  });
});

describe("Reading time", () => {
  test("Counts words across text blocks, not blocks", () => {
    expect(getReadingMinutes([block(words(660))])).toBe(3);
    expect(getReadingMinutes(Array.from({ length: 40 }, () => block("Short line.")))).toBe(1);
  });

  test("Never reports less than one minute", () => {
    expect(getReadingMinutes([])).toBe(1);
    expect(readingMinutesFromWords(0)).toBe(1);
    expect(readingMinutesFromWords(479)).toBe(2);
  });

  test("Ignores image blocks", () => {
    expect(getReadingMinutes([block(words(440)), IMAGE])).toBe(2);
  });
});

describe("Excerpts", () => {
  test("Prefers the editor's excerpt", () => {
    expect(getExcerpt({ body: [block("Opening paragraph.")], excerpt: " Written summary. " })).toBe(
      "Written summary."
    );
  });

  test("Skips an opening paragraph that only repeats the title", () => {
    const post = {
      body: [
        block("The world is complicated. Your team still deserves to travel."),
        block("Fuel prices are up. Airlines are cutting routes."),
      ],
      title: "The world is complicated. Your team still deserves to travel",
    };
    expect(getExcerpt(post)).toBe("Fuel prices are up. Airlines are cutting routes.");
  });

  test("Shortens long openings at a word boundary", () => {
    const excerpt = getExcerpt({ body: [block(words(80))], title: "T" }, 60);
    expect(excerpt.length).toBeLessThanOrEqual(61);
    expect(excerpt.endsWith("…")).toBe(true);
    expect(excerpt).not.toContain("word7…x");
  });

  test("Drops an opening heading that repeats the title", () => {
    const body = [block("Why MICE planning matters", "h1"), block("First paragraph.")];
    expect(withoutRepeatedTitle(body, "Why MICE Planning Matters")).toEqual([body[1]]);
    expect(withoutRepeatedTitle(body, "Something else")).toEqual(body);
  });
});

describe("Image alt text", () => {
  test("Uses alt, then caption, then the fallback, only when alt is empty", () => {
    expect(getImageAlt({ alt: "Delegates at Udaipur", caption: "Caption" }, "Title")).toBe(
      "Delegates at Udaipur"
    );
    expect(getImageAlt({ alt: "  ", caption: "Ghats at dawn" }, "Title")).toBe("Ghats at dawn");
    expect(getImageAlt({}, "Exploring Malta")).toBe("Exploring Malta");
    expect(getImageAlt(null)).toBe("");
  });
});

describe("Images", () => {
  test("Reads the cropped size from the asset reference", () => {
    expect(getImageDimensions(IMAGE)).toEqual({ height: 1058, width: 1152 });
    expect(getImageDimensions({ asset: { _ref: "image-x-1080x1350-png" } })).toEqual({
      height: 1350,
      width: 1080,
    });
  });

  test("Keeps a plate at its own proportions with the editor's crop", () => {
    const plate = getPlateImage(IMAGE, 800);
    expect(plate.width).toBe(800);
    expect(plate.height).toBe(Math.round((800 * 1058) / 1152));
    expect(plate.src).toContain("rect=192,0,1152,1058");
  });

  test("Fixed-size crops follow the hotspot", () => {
    const url = getCroppedImageUrl(IMAGE, 1200, 630);
    expect(url).toContain("w=1200");
    expect(url).toContain("h=630");
    expect(url).toContain("rect=192,227,1152,605");
  });

  test("Returns null without an asset", () => {
    expect(getPlateImage(null)).toBeNull();
    expect(getCroppedImageUrl({}, 10, 10)).toBeNull();
  });
});

describe("Index structure", () => {
  const post = (n, date) => ({ _id: `p${n}`, publishedAt: date, slug: { current: `post-${n}` } });

  test("One story is a lead with no other sections", () => {
    expect(splitJournalIndex([post(1, "2026-01-01")])).toEqual({
      archive: [],
      contents: [],
      lead: post(1, "2026-01-01"),
    });
  });

  test("Stories beyond twelve move to the archive", () => {
    const posts = Array.from({ length: 15 }, (_, index) => post(index, "2026-01-01"));
    const { archive, contents, lead } = splitJournalIndex(posts);
    expect(lead._id).toBe("p0");
    expect(contents).toHaveLength(11);
    expect(archive.map((item) => item._id)).toEqual(["p12", "p13", "p14"]);
  });

  test("Skips posts without a slug and handles no posts", () => {
    expect(splitJournalIndex([{ _id: "x" }]).lead).toBeNull();
    expect(splitJournalIndex(null).lead).toBeNull();
  });

  test("Groups the archive by year", () => {
    const groups = groupPostsByYear([
      post(1, "2025-07-12T00:00:00Z"),
      post(2, "2024-03-01T00:00:00Z"),
    ]);
    expect(groups.map((group) => group.year)).toEqual(["2025", "2024"]);
  });
});

describe("Bylines and trails", () => {
  test("Builds the role line from optional fields", () => {
    expect(getAuthorRoleLine({ office: "Kolkata", role: "Director" })).toBe("Director, Kolkata");
    expect(getAuthorRoleLine({ role: "Director" })).toBe("Director");
    expect(getAuthorRoleLine({ office: "Bengaluru" })).toBe("Bengaluru office");
    expect(getAuthorRoleLine({ name: "No role" })).toBe("");
  });

  test("Accepts only slug-shaped trail references", () => {
    expect(isTrailSlug("kailash-aerial-3day")).toBe(true);
    expect(isTrailSlug("../admin")).toBe(false);
    expect(isTrailSlug(undefined)).toBe(false);
  });
});

describe("Structured data", () => {
  const post = {
    _createdAt: "2026-08-02T18:05:29Z",
    _updatedAt: "2026-08-02T18:35:51Z",
    author: { name: "A Director", role: "Director" },
    body: [block(words(300))],
    categories: [{ title: "MICE" }, { title: null }],
    excerpt: "Plan early.",
    publishedAt: "2026-08-02T18:25:00.000Z",
    slug: { current: "smarter-mice-planning" },
    title: "Smarter MICE Planning",
  };

  test("Describes a story as a BlogPosting in the Citius Journal", () => {
    const jsonLd = buildBlogPostingJsonLd(post, { imageUrl: "https://cdn.example/cover.jpg" });
    expect(jsonLd).toMatchObject({
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      author: { "@type": "Person", jobTitle: "Director", name: "A Director" },
      dateModified: "2026-08-02T18:35:51Z",
      datePublished: "2026-08-02T18:25:00.000Z",
      description: "Plan early.",
      headline: "Smarter MICE Planning",
      image: ["https://cdn.example/cover.jpg"],
      isPartOf: { "@type": "Blog", name: "Citius Journal" },
      keywords: "MICE",
      mainEntityOfPage: { "@id": "https://www.citiusholidays.com/blog/smarter-mice-planning" },
      publisher: { "@type": "Organization", name: "Citius Holidays" },
      wordCount: 300,
    });
  });

  test("Leaves out what the story does not have", () => {
    const jsonLd = buildBlogPostingJsonLd({ slug: { current: "x" }, title: "X" });
    expect(jsonLd.image).toBeUndefined();
    expect(jsonLd.datePublished).toBeUndefined();
    expect(jsonLd.author).toEqual({
      "@type": "Organization",
      name: "Citius Holidays",
      url: "https://www.citiusholidays.com",
    });
  });

  test("Builds an ordered breadcrumb trail", () => {
    const jsonLd = buildBreadcrumbJsonLd([
      { name: "Citius Holidays", url: "https://www.citiusholidays.com" },
      { name: "Citius Journal", url: "https://www.citiusholidays.com/blog" },
    ]);
    expect(jsonLd["@type"]).toBe("BreadcrumbList");
    expect(jsonLd.itemListElement.map((item) => item.position)).toEqual([1, 2]);
    expect(jsonLd.itemListElement[1]).toMatchObject({
      "@type": "ListItem",
      name: "Citius Journal",
    });
  });

  test("Escapes markup so CMS text cannot close the script element", () => {
    const serialized = serializeJsonLd({ headline: "</script><script>alert(1)</script>" });
    expect(serialized).not.toContain("</script>");
    expect(JSON.parse(serialized).headline).toBe("</script><script>alert(1)</script>");
  });
});
