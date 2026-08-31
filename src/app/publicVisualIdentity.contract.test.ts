import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const GLOBALS = readFileSync("src/app/globals.css", "utf8");
const ROOT_LAYOUT = readFileSync("src/app/layout.js", "utf8");
const MOBILE_MENU = readFileSync("src/components/layout/HeaderMobileMenu.js", "utf8");
const HOME = readFileSync("src/components/pages/HomeMainClient.js", "utf8");
const SPIRITUAL_HERO = readFileSync("src/components/pilgrimage/SpiritualHero.js", "utf8");
const MICE = readFileSync("src/app/(public)/mice/page.client.js", "utf8");
const PILGRIMAGE = readFileSync("src/app/(public)/pilgrimage/page.client.js", "utf8");
const SPIRITUAL_TRAILS_HUB = readFileSync(
  "src/components/pilgrimage/SpiritualTrailsHub.js",
  "utf8"
);
const SACRED_SITES = readFileSync("src/components/pilgrimage/SacredSitesVisual.js", "utf8");
const JOURNEY_COMPARISON = readFileSync("src/components/pilgrimage/JourneyComparison.js", "utf8");
const TESTIMONIALS = readFileSync("src/components/pilgrimage/TestimonialsSection.js", "utf8");
const GALLERY = readFileSync("src/components/ui/GalleryGrid.js", "utf8");
const CHATBOT_WINDOW = readFileSync("src/components/ui/ChatbotWindow.js", "utf8");
const SACRED_EDITION = readFileSync(
  "src/components/sacredBharat/edition/SacredBharatEdition.js",
  "utf8"
);
const BODY_INTER_PATTERN = /body\s*{[^}]*font-family:\s*var\(--font-inter\)/s;
const MOBILE_HEADING_PATTERN = /<h2[\s\S]*?font-heading[\s\S]*?data-mobile-menu-heading=""/;
const HOME_WHY_OVERLINE_PATTERN = /<p[^>]*uppercase[^>]*>\s*Why Citius/s;
const HOME_IMPACT_OVERLINE_PATTERN = /<p[^>]*uppercase[^>]*>\s*Our Impact/s;
const SPIRITUAL_OVERLINE_PATTERN = /uppercase[^>]*>\s*Citius Spiritual Trails/s;
const MICE_OVERLINE_PATTERNS = [
  /<p[^>]*uppercase[^>]*>\s*The operating model/s,
  /<p[^>]*uppercase[^>]*>\s*The evidence/s,
  /<p[^>]*uppercase[^>]*>\s*The next step/s,
];
const REVIEWED_OVERLINE_PATTERNS = [
  [PILGRIMAGE, /uppercase[^>]*>\s*Citius Spiritual Trails/s],
  [PILGRIMAGE, /uppercase[^>]*>\s*Why Choose Citius/s],
  [PILGRIMAGE, /uppercase[^>]*>\s*Visual Stories/s],
  [SPIRITUAL_TRAILS_HUB, /uppercase[^>]*>\s*Explore trails/s],
  [SACRED_SITES, /uppercase[^>]*>\s*Sacred Geography/s],
  [JOURNEY_COMPARISON, /uppercase[^>]*>\s*Choose Your Path/s],
  [TESTIMONIALS, /uppercase[^>]*>\s*Traveller Stories/s],
] as const;

const PUBLIC_TOKENS = [
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
] as const;

const PUBLIC_MATERIAL_OWNERS = [
  { count: 1, path: "src/components/layout/Header.js" },
  { count: 1, path: "src/components/layout/HeaderSignInDropdown.js" },
  { count: 1, path: "src/components/layout/HeaderUserMenu.js" },
  { count: 1, path: "src/components/pages/HeroVideo.js" },
  { count: 1, path: "src/components/pages/HomeHeroClient.js" },
  { count: 1, path: "src/components/pilgrimage/SacredSitesVisual.js" },
  { count: 1, path: "src/components/pilgrimage/SpiritualHero.js" },
  { count: 1, path: "src/components/pilgrimage/TrailHeroSlideshow.js" },
  { count: 4, path: "src/components/sacredBharat/edition/SacredBharatEdition.js" },
  { count: 1, path: "src/components/ui/GalleryGrid.js" },
  { count: 1, path: "src/components/ui/PublicContactCta.js" },
  { count: 1, path: "src/components/ui/TrendingDestinations.js" },
].map((owner) => ({ ...owner, source: readFileSync(owner.path, "utf8") }));
const PUBLIC_NIGHT_MATERIAL_PATTERN =
  /\.material-public-night\s*{\s*--material-preference-background:\s*var\(--color-public-night\);\s*--material-preference-boundary:\s*var\(--color-public-surface\);\s*}/s;

type Oklch = readonly [number, number, number];

function readOklch(token: (typeof PUBLIC_TOKENS)[number]): Oklch {
  const escapedToken = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = GLOBALS.match(
    new RegExp(`${escapedToken}:\\s*oklch\\(([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)\\)`)
  );
  if (!match) {
    throw new Error(`Missing numeric OKLCH token ${token}`);
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function linearSrgb([lightness, chroma, hue]: Oklch) {
  const radians = (hue * Math.PI) / 180;
  const a = chroma * Math.cos(radians);
  const b = chroma * Math.sin(radians);
  const l = (lightness + 0.396_337_777_4 * a + 0.215_803_757_3 * b) ** 3;
  const m = (lightness - 0.105_561_345_8 * a - 0.063_854_172_8 * b) ** 3;
  const s = (lightness - 0.089_484_177_5 * a - 1.291_485_548 * b) ** 3;
  return [
    4.076_741_662_1 * l - 3.307_711_591_3 * m + 0.230_969_929_2 * s,
    -1.268_438_004_6 * l + 2.609_757_401_1 * m - 0.341_319_396_5 * s,
    -0.004_196_086_3 * l - 0.703_418_614_7 * m + 1.707_614_701 * s,
  ] as const;
}

function relativeLuminance(color: Oklch) {
  const [red, green, blue] = linearSrgb(color);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(foreground: Oklch, background: Oklch) {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  return (
    (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
  );
}

describe("public visual identity contract", () => {
  test("keeps every owned public token inside sRGB", () => {
    for (const token of PUBLIC_TOKENS) {
      for (const channel of linearSrgb(readOklch(token))) {
        expect(channel).toBeGreaterThanOrEqual(0);
        expect(channel).toBeLessThanOrEqual(1);
      }
    }
  });

  test("keeps the six owned text pairs at WCAG AA", () => {
    const pairs = [
      ["--color-public-ink", "--color-public-paper"],
      ["--color-public-muted", "--color-public-paper"],
      ["--color-public-blue", "--color-public-paper"],
      ["--color-public-orange-ink", "--color-public-paper"],
      ["--color-public-orange", "--color-public-night"],
      ["--color-public-surface", "--color-public-night"],
    ] as const;

    for (const [foreground, background] of pairs) {
      expect(contrastRatio(readOklch(foreground), readOklch(background))).toBeGreaterThanOrEqual(
        4.5
      );
    }
  });

  test("keeps Inter on body and controls while the mobile display heading uses Poppins", () => {
    expect(ROOT_LAYOUT).toContain('variable: "--font-inter"');
    expect(ROOT_LAYOUT).toContain('variable: "--font-poppins"');
    expect(GLOBALS).toMatch(BODY_INTER_PATTERN);
    expect(ROOT_LAYOUT).toContain('style: ["normal", "italic"]');
    expect(GLOBALS).toContain("font-synthesis: none");
    expect(MOBILE_MENU).toContain('data-mobile-menu-heading=""');
    expect(MOBILE_MENU).toMatch(MOBILE_HEADING_PATTERN);
  });

  test("keeps the mobile sheet bound to platform safe areas and a zero-duration reduced-motion endpoint", () => {
    for (const edge of ["top", "right", "bottom", "left"] as const) {
      expect(GLOBALS).toContain(`--safe-area-inset-${edge}: env(safe-area-inset-${edge}, 0px);`);
      expect(MOBILE_MENU).toContain(`var(--safe-area-inset-${edge})`);
    }
    expect(MOBILE_MENU).toContain("pt-[max(0.75rem,var(--safe-area-inset-top))]");
    expect(MOBILE_MENU).toContain("pr-[max(1rem,var(--safe-area-inset-right))]");
    expect(MOBILE_MENU).toContain("pb-[max(1rem,var(--safe-area-inset-bottom))]");
    expect(MOBILE_MENU).toContain("px-[max(1rem,var(--safe-area-inset-left))]");
    expect(MOBILE_MENU).toContain("duration: shouldReduceMotion ? 0 : 0.22");
    expect(MOBILE_MENU).toContain(
      'initial={{ transform: shouldReduceMotion ? "none" : "translate3d(100%, 0, 0)" }}'
    );
    expect(MOBILE_MENU).toContain("motion-reduce:transition-none");
  });

  test("keeps public preference fallbacks product-owned and opaque", () => {
    expect(GLOBALS).toContain("@media (prefers-reduced-transparency: reduce)");
    expect(GLOBALS).toContain("@media (prefers-contrast: more)");
    expect(GLOBALS).toContain(".material-public-night");
    expect(GLOBALS).toContain(".public-site .text-public-muted");
    expect(GALLERY).toContain("material-structural");
    expect(SACRED_EDITION).toContain("material-decorative-glass");
    expect(CHATBOT_WINDOW).toContain("chatbot-dialog-backdrop");
    expect(GLOBALS).toContain(".portal-entity-modal-backdrop");
    expect(GLOBALS).toContain(".chatbot-dialog-backdrop");
  });

  test("centralizes the exact public night material recipe", () => {
    expect(GLOBALS).toMatch(PUBLIC_NIGHT_MATERIAL_PATTERN);
    for (const owner of PUBLIC_MATERIAL_OWNERS) {
      expect(owner.source.match(/material-public-night/g) ?? [], owner.path).toHaveLength(
        owner.count
      );
      expect(owner.source, owner.path).not.toContain(
        "[--material-preference-background:var(--color-public-night)] [--material-preference-boundary:var(--color-public-surface)]"
      );
      for (const foreignToken of [
        "--color-brand-light",
        "--account-surface",
        "--material-preference-background:#FDFBF7",
      ]) {
        expect(owner.source, owner.path).not.toContain(foreignToken);
      }
    }
  });

  test("does not restore the reviewed public eyebrow labels", () => {
    expect(HOME).not.toMatch(HOME_WHY_OVERLINE_PATTERN);
    expect(HOME).not.toMatch(HOME_IMPACT_OVERLINE_PATTERN);
    expect(SPIRITUAL_HERO).not.toMatch(SPIRITUAL_OVERLINE_PATTERN);
    for (const pattern of MICE_OVERLINE_PATTERNS) {
      expect(MICE).not.toMatch(pattern);
    }
    for (const [source, pattern] of REVIEWED_OVERLINE_PATTERNS) {
      expect(source).not.toMatch(pattern);
    }
  });
});
