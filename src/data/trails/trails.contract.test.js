import { describe, expect, test } from "bun:test";
import { file as bunFile } from "bun";
import { resolveCanonicalTempleId } from "@/data/sacredBharat/templeAliases";
import { TRAILS as SACRED_BHARAT_TRAILS } from "@/data/sacredBharat/trails";
import { suggestNextJourneys } from "@/lib/sacredBharat/journeyPlanner";
import { computeProgress } from "@/lib/sacredBharat/scoring";
import {
  getTrailBySlug,
  getTrailSlugsForStaticParams,
  getTrailsForHub,
  groupTrailsForHub,
  TRAILS,
  toYoutubeEmbedUrl,
} from "../trails";

const PUBLIC_TRAIL_SLUGS = [
  "kailash-mansarovar-14day",
  "kailash-aerial-3day",
  "kora-north-trail",
  "kora-east-trail",
  "kora-west-trail",
  "kora-south-trail",
  "sacred-festivals",
  "corporate-retreat",
];

const SACRED_BHARAT_TRAIL_SLUGS = [
  "shiva-trail",
  "char-dham-trail",
  "ramayana-trail",
  "krishna-trail",
  "shakti-trail",
  "vishnu-trail",
  "sacred-rivers-trail",
  "moksha-cities-trail",
  "divine-south-trail",
  "himalayan-awakening-trail",
  "temple-architecture-trail",
  "bharat-explorer-trail",
];

describe("public trail catalog decomposition", () => {
  test("preserves stable identifiers, order, and public static params", () => {
    expect(TRAILS.map((trail) => trail.slug)).toEqual(PUBLIC_TRAIL_SLUGS);
    expect(getTrailsForHub().map((trail) => trail.slug)).toEqual(PUBLIC_TRAIL_SLUGS);
    expect(getTrailSlugsForStaticParams()).toEqual(PUBLIC_TRAIL_SLUGS.map((slug) => ({ slug })));
    expect(getTrailBySlug("kailash-mansarovar-14day")?.title).toBe("Kailash Mansarovar Yatra 2026");
  });

  test("preserves hub group ordering and URL helper behavior", () => {
    expect(groupTrailsForHub(getTrailsForHub()).map((group) => group.id)).toEqual([
      "kailash-mansarovar",
      "kora-routes",
      "special-programs",
    ]);
    expect(toYoutubeEmbedUrl("https://youtu.be/abc123?t=1")).toBe(
      "https://www.youtube.com/embed/abc123"
    );
    expect(toYoutubeEmbedUrl("https://www.youtube.com/watch?v=xyz789")).toBe(
      "https://www.youtube.com/embed/xyz789"
    );
  });

  test("keeps every decomposed trail source below 500 lines", async () => {
    const paths = [
      "src/data/trails/kailashMansarovar.js",
      "src/data/trails/kailashAerial.js",
      "src/data/trails/additionalTrails.js",
      "src/data/trails/supportingContent.js",
      "src/components/pilgrimage/trailSection/TrailCoreTabs.js",
      "src/components/pilgrimage/trailSection/TrailDetailsTabs.js",
      "src/components/pilgrimage/trailSection/TrailMediaTabs.js",
      "src/components/pilgrimage/trailSection/TrailShell.js",
    ];
    const sizes = await Promise.all(
      paths.map(async (path) => ({
        lines: (await bunFile(path).text()).split("\n").length,
        path,
      }))
    );
    expect(sizes.filter(({ lines }) => lines > 500)).toEqual([]);
  });
});

describe("Sacred Bharat trail contracts", () => {
  test("preserves catalog order, aliases, scoring, and Journey Planner inputs", () => {
    expect(SACRED_BHARAT_TRAILS.map((trail) => trail.slug)).toEqual(SACRED_BHARAT_TRAIL_SLUGS);
    expect(resolveCanonicalTempleId("rameswaram")).toBe("ramanathaswamy");
    expect(resolveCanonicalTempleId("varanasi")).toBe("kashi-vishwanath");

    const progress = computeProgress(["rameswaram", "ramanathaswamy", "varanasi"]);
    expect(progress.templeCount).toBe(2);
    expect(progress.score).toBe(
      progress.templePointsTotal + progress.trailBonusTotal + progress.challengeBonusTotal
    );

    expect(
      suggestNextJourneys([], { limit: 4, trailSlug: "char-dham-trail" }).map(
        (plan) => plan.temple.id
      )
    ).toEqual(["badrinath", "jagannath", "ramanathaswamy", "dwarka"]);
  });
});
