import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const HEX_COLOR_LITERAL = /#[\da-f]{3,8}/i;
const DECORATIVE_VARANASI_ASSET =
  /alt:\s*""[\s\S]{0,160}src:\s*"\/gallery\/spiritual\/varanasi-sunset\.webp"/;
const SACRED_TRAIL_TITLE = /title: `\$\{trail\.title\} \| Sacred Bharat`,/;
const sacredBharatHero = readFileSync("src/components/sacredBharat/SacredBharatHero.js", "utf8");
const sacredBharatPage = readFileSync("src/app/(public)/sacred-bharat/page.js", "utf8");
const sacredBharatLeaderboardPage = readFileSync(
  "src/app/(public)/sacred-bharat/leaderboard/page.js",
  "utf8"
);
const sacredBharatTrailPage = readFileSync(
  "src/app/(public)/sacred-bharat/trails/[slug]/page.js",
  "utf8"
);
const spiritualHero = readFileSync("src/components/pilgrimage/SpiritualHero.js", "utf8");
const identityKit = readFileSync("docs/SACRED_BHARAT_IDENTITY_KIT.md", "utf8");

describe("Sacred Bharat text-led identity", () => {
  test("keeps the approved phrase without an unverified trademark mark", () => {
    expect(sacredBharatHero).toContain("Journey of the Soul");
    expect(`${sacredBharatHero}\n${sacredBharatPage}`).not.toContain("™");
  });

  test("lets the root title template add the parent name once", () => {
    expect(sacredBharatPage).toContain('title: "Sacred Bharat – Journey of the Soul",');
    expect(sacredBharatPage).not.toContain(
      'title: "Sacred Bharat – Journey of the Soul | Citius Holidays"'
    );
    expect(sacredBharatLeaderboardPage).toContain('title: "Leaderboard | Sacred Bharat",');
    expect(sacredBharatTrailPage).toMatch(SACRED_TRAIL_TITLE);
  });

  test("uses the public token family and a visible parent endorsement", () => {
    expect(sacredBharatHero).toContain("by Citius Holidays");
    expect(sacredBharatHero).toContain("bg-public-night");
    expect(sacredBharatHero).toContain("text-public-orange");
    expect(sacredBharatHero).not.toContain("bg-brand-dark");
    expect(sacredBharatHero).not.toContain("text-citius-orange");
    expect(sacredBharatHero).not.toMatch(HEX_COLOR_LITERAL);
  });

  test("classifies the unknown-origin Varanasi asset as decorative", () => {
    expect(spiritualHero).not.toContain('alt: "Varanasi Sunset"');
    expect(spiritualHero).toMatch(DECORATIVE_VARANASI_ASSET);
    expect(identityKit).toContain("/gallery/spiritual/varanasi-sunset.webp");
    expect(identityKit).toContain("Unknown origin");
    expect(identityKit).toContain("Decorative only");
  });
});
