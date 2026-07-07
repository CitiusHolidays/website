import { describe, expect, test } from "bun:test";
import {
  buildPassportShareText,
  buildPublicPassportStats,
  buildRegionSummary,
  buildTrailHighlights,
} from "./yatriPassport.js";

describe("yatriPassport", () => {
  test("summarizes regions and public stats", () => {
    const regions = buildRegionSummary(["kedarnath", "meenakshi"]);
    expect(regions.some((region) => region.region === "north" && region.visited === 1)).toBe(true);
    const stats = buildPublicPassportStats({ completedTrailCount: 0, score: 50, templeCount: 2 });
    expect(stats.find((stat) => stat.label === "Temples").value).toBe(2);
  });

  test("builds highlights and share text", () => {
    const highlights = buildTrailHighlights({
      trails: [
        { complete: false, percent: 30, slug: "a", title: "A" },
        { complete: false, percent: 80, slug: "b", title: "B" },
      ],
    });
    expect(highlights.map((trail) => trail.slug)).toEqual(["b"]);
    expect(buildPassportShareText({ displayName: "Nisha" }, { templeCount: 4 })).toContain("Nisha");
  });
});
