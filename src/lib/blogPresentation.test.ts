import { describe, expect, test } from "bun:test";
import { blogCoverAlt, blogDate, blogExcerpt } from "./blogPresentation";

describe("Journal metadata and editorial media", () => {
  test.each([undefined, null, "", "not a date", "2026-02-30", "2026-13-01", "1", 0])(
    "omits missing and invalid date %s",
    (value) => expect(blogDate(value)).toBeNull()
  );

  test("accepts real calendar dates without replacing their day with a reader timezone", () => {
    expect(blogDate("2024-02-29")).toEqual({ dateTime: "2024-02-29", label: "29 February 2024" });
    expect(blogDate("2026-08-02T00:00:00+05:30")?.label).toBe("2 August 2026");
  });

  test("uses text-led cards for absent, poster, or unreviewed cover assets", () => {
    expect(blogCoverAlt({})).toBeNull();
    expect(
      blogCoverAlt({
        mainImage: {
          asset: { _ref: "image-b37349bb07b2f4c0a1db9ea8e5c36d7353e85a55-1080x1350-png" },
        },
      })
    ).toBeNull();
    expect(blogCoverAlt({ mainImage: { asset: { _ref: "unreviewed" } } })).toBeNull();
    expect(
      blogCoverAlt({
        mainImage: {
          asset: { _ref: "image-6c9a1a786a8059b9957c042c4c47b0ebb703d892-3200x1524-jpg" },
        },
      })
    ).toBe("Rocky coastline and a sheltered bay in Malta");
  });

  test("an excerpt adds story context instead of repeating a title; body blocks remain untouched", () => {
    const opening = [
      { text: "Indian Traveler's Abroad" },
      { text: "Travel is an opportunity to listen and learn." },
    ];
    expect(blogExcerpt({ opening, title: "Indian Travelers Abroad" })).toBe(opening[1].text);
    expect(opening).toHaveLength(2);
    expect(blogExcerpt({ opening: [], title: "A story" })).toBeNull();
    expect(blogExcerpt({ excerpt: "A concise introduction.", title: "A story" })).toBe(
      "A concise introduction."
    );
  });
});
