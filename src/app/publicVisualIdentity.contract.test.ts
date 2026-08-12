import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(relativePath: string) {
  return readFileSync(join(root, relativePath), "utf8");
}

const PUBLIC_LAYOUT = "src/app/(public)/layout.js";
const GLOBALS_CSS = "src/app/globals.css";
const PORTAL_LAYOUT = "src/app/portal/layout.js";
const AUTH_LAYOUT = "src/app/(auth)/layout.js";
const ROOT_LAYOUT = "src/app/layout.js";

const PUBLIC_SURFACES = [
  "src/components/pages/HomeHeroClient.js",
  "src/components/pages/HomeMainClient.js",
  "src/app/(public)/about/page.client.js",
  "src/app/(public)/services/page.client.js",
  "src/app/(public)/mice/page.client.js",
  "src/app/(public)/gallery/page.client.js",
  "src/app/(public)/blog/page.client.js",
  "src/app/(public)/blog/[slug]/page.client.js",
  "src/app/(public)/contact/page.client.js",
  "src/app/(public)/pilgrimage/page.client.js",
  "src/components/pilgrimage/SpiritualHero.js",
  "src/app/(public)/sacred-bharat/page.client.js",
];

const LIGHT_ORANGE_INK_SURFACES = [
  "src/components/pilgrimage/SpiritualTrailsHub.js",
  "src/components/pilgrimage/SacredSitesVisual.js",
  "src/components/pilgrimage/JourneyComparison.js",
  "src/components/pilgrimage/TestimonialsSection.js",
  "src/components/pilgrimage/trailSection/TrailCoreTabs.js",
  "src/components/pilgrimage/trailSection/TrailDetailsTabs.js",
  "src/components/pilgrimage/trailSection/TrailMediaTabs.js",
  "src/components/sacredBharat/ChallengeGrid.js",
  "src/components/sacredBharat/GuestSaveBanner.js",
  "src/components/sacredBharat/JourneyPlannerPanel.js",
  "src/components/sacredBharat/LeaderboardTable.js",
  "src/components/sacredBharat/LevelBadge.js",
  "src/components/sacredBharat/TrailCardGrid.js",
  "src/components/ui/AwardsShowcase.js",
  "src/components/ui/CircularServicesMenu.js",
  "src/components/ui/LocationCard.js",
  "src/components/ui/NumberTicker.js",
  "src/components/ui/TeamMember.js",
  "src/app/(public)/pilgrimage/page.client.js",
  "src/app/(public)/sacred-bharat/page.client.js",
  "src/app/(public)/sacred-bharat/leaderboard/page.client.js",
  "src/app/(public)/sacred-bharat/trails/[slug]/page.client.js",
];

const PUBLIC_OKLCH_TOKENS = [
  "--color-public-paper",
  "--color-public-surface",
  "--color-public-night",
  "--color-public-ink",
  "--color-public-muted",
  "--color-public-blue",
  "--color-public-orange",
  "--color-public-orange-ink",
  "--color-public-green",
  "--color-public-lime",
];

const OKLCH_VALUE_PATTERN = /oklch\(/;
const PUBLIC_HEADING_PATTERN = /font-heading/;
const PUBLIC_LITERAL_BACKGROUND_PATTERN = /bg-\[#/;
const PUBLIC_TOKEN_PATTERN =
  /public-(paper|surface|night|ink|blue|orange|orange-ink|green|lime|muted)/;
const OKLCH_CHANNEL_PATTERN = /oklch\(([\d.]+) ([\d.]+) ([\d.]+)/;
const PUBLIC_MEDIA_RADIUS_PATTERN = /--radius-public-media:\s*[^;]+;/;
const PUBLIC_MEDIA_SHADOW_PATTERN = /--shadow-public-media:\s*[^;]+;/;
const DISABLED_DYNAMIC_SSR_PATTERN = /ssr:\s*false/;

function readOklchToken(source: string, token: string) {
  const tokenLine = source.split("\n").find((line) => line.includes(`${token}:`));
  const channels = tokenLine?.match(OKLCH_CHANNEL_PATTERN);
  if (!channels) {
    throw new Error(`Missing numeric OKLCH token ${token}`);
  }
  return channels.slice(1).map(Number) as [number, number, number];
}

function relativeLuminance([lightness, chroma, hue]: [number, number, number]) {
  const radians = (hue * Math.PI) / 180;
  const a = chroma * Math.cos(radians);
  const b = chroma * Math.sin(radians);
  const l = (lightness + 0.396_337_777_4 * a + 0.215_803_757_3 * b) ** 3;
  const m = (lightness - 0.105_561_345_8 * a - 0.063_854_172_8 * b) ** 3;
  const s = (lightness - 0.089_484_177_5 * a - 1.291_485_548 * b) ** 3;
  const red = 4.076_741_662_1 * l - 3.307_711_591_3 * m + 0.230_969_929_2 * s;
  const green = -1.268_438_004_6 * l + 2.609_757_401_1 * m - 0.341_319_396_5 * s;
  const blue = -0.004_196_086_3 * l - 0.703_418_614_7 * m + 1.707_614_701 * s;
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(foreground: [number, number, number], background: [number, number, number]) {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  return (
    (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
  );
}

describe("public visual identity contract", () => {
  test("home showcase sections participate in server rendering", () => {
    const source = read("src/components/pages/HomeMainClient.js");

    for (const section of [
      "ClientShowcase",
      "PartnerShowcase",
      "TrendingDestinations",
      "AwardsShowcase",
    ]) {
      expect(source).toContain(`const ${section} = dynamic(`);
    }
    expect(source).not.toMatch(DISABLED_DYNAMIC_SSR_PATTERN);
  });

  test("public layout scopes public-site wrapper", () => {
    const source = read(PUBLIC_LAYOUT);

    expect(source).toContain("public-site");
    expect(source).not.toContain("Fraunces");
    expect(source).not.toContain("--font-fraunces");
  });

  test("globals define OKLCH public tokens, visible emphasis, and selection pair", () => {
    const source = read(GLOBALS_CSS);

    for (const token of PUBLIC_OKLCH_TOKENS) {
      expect(source).toContain(token);
      const line = source.split("\n").find((entry) => entry.includes(token)) ?? "";
      expect(line).toMatch(OKLCH_VALUE_PATTERN);
    }

    expect(source).not.toContain("--font-display:");
    expect(source).not.toContain("font-synthesis: none");
    expect(source).toContain("-webkit-font-smoothing: antialiased");
    expect(source).toContain(".public-site ::selection");
    expect(source).toContain(".public-site .public-media-edge");
    expect(source).toContain("var(--radius-public-media)");
    expect(source).toContain("var(--shadow-public-media)");
  });

  test("public media uses one bounded edge and shadow token pair", () => {
    const source = read(GLOBALS_CSS);
    expect(source).toMatch(PUBLIC_MEDIA_RADIUS_PATTERN);
    expect(source).toMatch(PUBLIC_MEDIA_SHADOW_PATTERN);
    expect(source).toContain("public-media-edge");
  });

  test("semantic text pairs meet WCAG AA for regular text", () => {
    const source = read(GLOBALS_CSS);
    const pairs = [
      ["--color-public-ink", "--color-public-paper"],
      ["--color-public-muted", "--color-public-paper"],
      ["--color-public-blue", "--color-public-paper"],
      ["--color-public-orange-ink", "--color-public-paper"],
      ["--color-public-orange", "--color-public-night"],
      ["--color-public-surface", "--color-public-night"],
    ] as const;

    for (const [foreground, background] of pairs) {
      expect(
        contrastRatio(readOklchToken(source, foreground), readOklchToken(source, background))
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  test("portal and auth layouts do not opt into the public wrapper or display font", () => {
    for (const layout of [PORTAL_LAYOUT, AUTH_LAYOUT, ROOT_LAYOUT]) {
      const source = read(layout);

      expect(source).not.toContain("public-site");
      expect(source).not.toContain("Fraunces");
      expect(source).not.toContain("--font-fraunces");
    }
  });

  test("representative public surfaces consume semantic tokens and heading typography", () => {
    for (const surface of PUBLIC_SURFACES) {
      const source = read(surface);

      expect(source).toMatch(PUBLIC_HEADING_PATTERN);
      expect(source).toMatch(PUBLIC_TOKEN_PATTERN);
      expect(source).not.toMatch(PUBLIC_LITERAL_BACKGROUND_PATTERN);
    }
  });

  test("imported light surfaces use orange ink while dark overlays keep vivid orange", () => {
    for (const surface of LIGHT_ORANGE_INK_SURFACES) {
      const source = read(surface);
      expect(source).toContain("text-public-orange-ink");
      expect(source).not.toContain("text-citius-orange");
    }

    for (const surface of [
      "src/components/pilgrimage/TrailHeroSlideshow.js",
      "src/components/pilgrimage/trailSection/TrailShell.js",
      "src/app/(public)/policies/page.client.js",
    ]) {
      const source = read(surface);
      expect(source).toContain("text-public-orange");
      expect(source).not.toContain("text-citius-orange");
    }
  });
});
