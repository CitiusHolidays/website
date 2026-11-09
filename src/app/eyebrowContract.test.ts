import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// DESIGN.md: no small, widely tracked label above a title. These surfaces had one.
const root = resolve(import.meta.dir, "../..");
const SURFACES = [
  "src/app/not-found.js",
  "src/app/(authenticated)/vendor/page.client.js",
  "src/app/(public)/mice/page.client.js",
  "src/app/(public)/pilgrimage/page.client.js",
  "src/components/account/AccountJourneysPanel.js",
  "src/components/account/AccountUi.js",
  "src/components/auth/PrivateAuthError.js",
  "src/components/layout/PublicRouteLoadingShell.js",
  "src/components/pages/HomeMainClient.js",
  "src/components/pilgrimage/JourneyComparison.js",
  "src/components/pilgrimage/SacredSitesVisual.js",
  "src/components/pilgrimage/SpiritualHero.js",
  "src/components/pilgrimage/SpiritualTrailsHub.js",
  "src/components/pilgrimage/TestimonialsSection.js",
  "src/components/pilgrimage/TrailHeroSlideshow.js",
];
const EYEBROW_BEFORE_HEADING =
  /<(p|span)\s+className="[^"]*(?:uppercase[^"]*tracking|tracking[^"]*uppercase)[^"]*"[^>]*>[^<]*<\/\1>\s*<h[1-6][\s>]/;

describe("Eyebrow labels", () => {
  test.each(SURFACES)("%s puts no tracked uppercase label above a heading", (file) => {
    expect(readFileSync(resolve(root, file), "utf8")).not.toMatch(EYEBROW_BEFORE_HEADING);
  });

  test("The trail hero shows the tagline after the title, not above it", () => {
    const source = readFileSync(
      resolve(root, "src/components/pilgrimage/TrailHeroSlideshow.js"),
      "utf8"
    );
    expect(source.indexOf("{trail.title}")).toBeLessThan(source.indexOf("{trail.tagline}"));
  });
});
