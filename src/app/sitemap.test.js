import { describe, expect, mock, test } from "bun:test";

mock.module("@/sanity/cachedFetch", () => ({
  cachedSanityFetch: () => [
    { _updatedAt: "2026-06-07T18:12:44Z", slug: "business-travel-in-a-changing-world" },
    { _updatedAt: "2026-08-30T13:17:16Z", slug: "tourism-in-the-age-of-disruption" },
  ],
}));
mock.module("@/data/trails", () => ({
  getTrailSlugsForStaticParams: () => [{ slug: "kailash-aerial-3day" }],
}));

const { default: sitemap } = await import("./sitemap.js");

describe("Sitemap", () => {
  test("Lists the Citius Journal index, dated by its latest story", async () => {
    const entries = await sitemap();
    const journal = entries.find((entry) => entry.url === "https://www.citiusholidays.com/blog");

    expect(journal).toBeDefined();
    expect(journal.lastModified).toBe("2026-08-30T13:17:16Z");
  });

  test("Keeps every story URL", async () => {
    const urls = (await sitemap()).map((entry) => entry.url);

    expect(urls).toContain(
      "https://www.citiusholidays.com/blog/business-travel-in-a-changing-world"
    );
    expect(urls).toContain("https://www.citiusholidays.com/blog/tourism-in-the-age-of-disruption");
    expect(urls).toContain("https://www.citiusholidays.com/pilgrimage/kailash-aerial-3day");
  });
});
