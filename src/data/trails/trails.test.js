import { describe, expect, test } from "bun:test";
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

const UNAVAILABLE_PROMISE_PATTERN = /brochure|priority|notified first/i;
const INTEREST_ACTION_PATTERN = /register interest/i;

describe("Public trail catalog", () => {
  test("Preserves stable identifiers, order, and public static params", () => {
    expect(TRAILS.map((trail) => trail.slug)).toEqual(PUBLIC_TRAIL_SLUGS);
    expect(getTrailsForHub().map((trail) => trail.slug)).toEqual(PUBLIC_TRAIL_SLUGS);
    expect(getTrailSlugsForStaticParams()).toEqual(PUBLIC_TRAIL_SLUGS.map((slug) => ({ slug })));
    expect(getTrailBySlug("kailash-mansarovar-14day")?.title).toBe("Kailash Mansarovar Yatra 2026");
  });

  test("Preserves hub group ordering and URL helper behavior", () => {
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

  test("Coming-soon programmes offer interest actions without brochure or priority promises", () => {
    const comingSoonTrails = TRAILS.filter((trail) => trail.status === "comingSoon");
    const bookingCopy = comingSoonTrails
      .flatMap((trail) => trail.bookingOptions)
      .map((option) => `${option.label} ${option.note}`);
    const overviewCopy = comingSoonTrails.flatMap((trail) => [
      ...(trail.overview?.intro ?? []),
      ...(trail.overview?.promise ?? []),
    ]);
    const comingSoonCopy = [...bookingCopy, ...overviewCopy].join(" ");

    expect(comingSoonCopy).not.toMatch(UNAVAILABLE_PROMISE_PATTERN);
    expect(comingSoonCopy).toMatch(INTEREST_ACTION_PATTERN);
  });
});

describe("Sacred Bharat trails", () => {
  test("Preserves catalog order, aliases, scoring, and Journey Planner inputs", () => {
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
