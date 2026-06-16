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
    const stats = buildPublicPassportStats({ templeCount: 2, score: 50, completedTrailCount: 0 });
    expect(stats.find((stat) => stat.label === "Temples").value).toBe(2);
  });

  test("builds highlights and share text", () => {
    const highlights = buildTrailHighlights({
      trails: [
        { slug: "a", title: "A", percent: 30, complete: false },
        { slug: "b", title: "B", percent: 80, complete: false },
      ],
    });
    expect(highlights.map((trail) => trail.slug)).toEqual(["b"]);
    expect(buildPassportShareText({ displayName: "Nisha" }, { templeCount: 4 })).toContain("Nisha");
  });
});
