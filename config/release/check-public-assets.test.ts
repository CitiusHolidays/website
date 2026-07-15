import { describe, expect, test } from "bun:test";
import { findMissingPublicAssetReferences } from "./check-public-assets";

describe("public asset reference smoke", () => {
  test("names the route source and missing public asset", () => {
    expect(
      findMissingPublicAssetReferences(
        [{ path: "src/app/(public)/about/page.js", source: '<img src="/gallery/missing.webp" />' }],
        new Set(["/gallery/aboutus.webp"])
      )
    ).toEqual([
      "src/app/(public)/about/page.js references missing public asset /gallery/missing.webp",
    ]);
  });

  test("accepts tracked media and ignores API/application routes", () => {
    expect(
      findMissingPublicAssetReferences(
        [
          {
            path: "src/components/pages/HeroVideo.js",
            source: '<video poster="/gallery/hero-poster.webp"><source src="/hero.webm" /></video>',
          },
          { path: "src/lib/example.ts", source: 'fetch("/api/portal/files/query/1")' },
        ],
        new Set(["/gallery/hero-poster.webp", "/hero.webm"])
      )
    ).toEqual([]);
  });
});
