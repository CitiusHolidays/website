import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");
const MAIN_ELEMENT_PATTERN = /<main(?:\s|>)/;
const STATIC_VIEWPORT_HEIGHT_PATTERN = /\bh-screen\b/;

const PUBLIC_DETAIL_ROUTES = [
  "src/app/(public)/blog/[slug]/page.js",
  "src/app/(public)/pilgrimage/[slug]/page.js",
  "src/app/(public)/sacred-bharat/groups/[groupId]/page.js",
  "src/app/(public)/sacred-bharat/trails/[slug]/page.js",
  "src/app/(public)/sacred-bharat/yatris/[slug]/page.js",
];

const OKLCH_CONVERSIONS = [
  ["--background", "oklch(0.985 0.002 247.839)", "#f9fafb"],
  ["--foreground", "oklch(0.21 0.032 264.665)", "#111827"],
  ["--color-citius-blue", "oklch(0.335 0.152 265.502)", "#102a83"],
  ["--color-citius-orange", "oklch(0.722 0.171 53.919)", "#f58220"],
  ["--color-citius-orange-ink", "oklch(0.443 0.128 44.307)", "#8a3500"],
  ["--color-citius-green", "oklch(0.761 0.174 129.577)", "#8dc63f"],
  ["--color-citius-lime", "oklch(0.82 0.176 120.498)", "#b5d43a"],
  ["--color-brand-dark", "oklch(0.208 0.04 265.755)", "#0f172a"],
  ["--color-brand-muted", "oklch(0.554 0.041 257.417)", "#64748b"],
  ["--color-brand-light", "oklch(0.984 0.003 247.858)", "#f8fafc"],
  ["--color-brand-border", "oklch(0.929 0.013 255.508)", "#e2e8f0"],
  ["--color-citius-blue", "oklch(0.335 0.152 265.502)", "#102a83"],
  ["--color-citius-orange", "oklch(0.657 0.107 74.398)", "#b8873f"],
  ["--color-citius-orange-ink", "oklch(0.486 0.081 68.309)", "#7d5628"],
  ["--color-citius-green", "oklch(0.512 0.074 164.032)", "#39745b"],
  ["--color-citius-lime", "oklch(0.73 0.093 81.901)", "#c5a261"],
  ["--color-brand-dark", "oklch(0.265 0.055 253.148)", "#10263f"],
  ["--color-brand-muted", "oklch(0.541 0.036 257.272)", "#627084"],
  ["--color-brand-light", "oklch(0.973 0.005 95.099)", "#f7f6f2"],
  ["--color-brand-border", "oklch(0.915 0.005 197.062)", "#dfe4e4"],
] as const;

function oklchToRgb(value: string) {
  const channels = value.match(/[\d.]+/g)?.map(Number);
  if (channels?.length !== 3) {
    throw new Error(`Invalid OKLCH value: ${value}`);
  }
  const [lightness, chroma, hue] = channels;
  const radians = (hue * Math.PI) / 180;
  const a = chroma * Math.cos(radians);
  const b = chroma * Math.sin(radians);
  const l = (lightness + 0.396_337_777_4 * a + 0.215_803_757_3 * b) ** 3;
  const m = (lightness - 0.105_561_345_8 * a - 0.063_854_172_8 * b) ** 3;
  const s = (lightness - 0.089_484_177_5 * a - 1.291_485_548 * b) ** 3;
  const linear = [
    4.076_741_662_1 * l - 3.307_711_591_3 * m + 0.230_969_929_2 * s,
    -1.268_438_004_6 * l + 2.609_757_401_1 * m - 0.341_319_396_5 * s,
    -0.004_196_086_3 * l - 0.703_418_614_7 * m + 1.707_614_701 * s,
  ];
  return linear.map((channel) => {
    const encoded = channel <= 0.003_130_8 ? 12.92 * channel : 1.055 * channel ** (1 / 2.4) - 0.055;
    return Math.round(Math.min(1, Math.max(0, encoded)) * 255);
  });
}

function hexToRgb(value: string) {
  return [1, 3, 5].map((start) => Number.parseInt(value.slice(start, start + 2), 16));
}

describe("public accessibility foundations", () => {
  test("owns one public and Account main landmark with a surface-specific bypass link", () => {
    const publicChrome = read("src/components/layout/AppChrome.js");
    const account = read("src/app/(authenticated)/account/page.client.js");
    expect(publicChrome).toContain('href="#public-main"');
    expect(publicChrome).toContain('id="public-main"');
    expect(account).toContain('href="#account-main"');
    expect(account).toContain('id="account-main"');

    for (const path of [
      "src/app/(public)/blog/page.client.js",
      "src/app/(public)/blog/[slug]/page.client.js",
      "src/app/(public)/policies/page.client.js",
      "src/app/(public)/sacred-bharat/challenges/page.js",
      "src/app/(public)/sacred-bharat/groups/[groupId]/page.client.js",
      "src/app/(public)/sacred-bharat/yatris/[slug]/page.client.js",
    ]) {
      expect(read(path), path).not.toMatch(MAIN_ELEMENT_PATTERN);
    }
  });

  test("keeps public header and full-height heroes viewport-safe", () => {
    const header = read("src/components/layout/Header.js");
    expect(header).toContain("useMotionValueEvent");
    expect(header).not.toContain('addEventListener("scroll"');
    expect(header).not.toContain("useTransform");
    expect(header).toContain("max-w-[1200px]");
    expect(header).not.toContain("lg:w-[1200px]");

    for (const path of [
      "src/components/pages/HomeHeroClient.js",
      "src/components/pilgrimage/TrailHeroSlideshow.js",
      "src/components/pilgrimage/SpiritualHero.js",
    ]) {
      expect(read(path), path).toContain("100dvh");
      expect(read(path), path).not.toMatch(STATIC_VIEWPORT_HEIGHT_PATTERN);
    }
    expect(read("src/components/pages/HomeHeroClient.js")).not.toContain(">Scroll<");
    expect(read("src/components/pilgrimage/SpiritualHero.js")).not.toContain("Scroll to Begin");
  });

  test("restores body typography, visible emphasis, and mobile editable sizing", () => {
    const layout = read("src/app/layout.js");
    const css = read("src/app/globals.css");
    expect(layout).not.toContain("font-heading`} lang");
    expect(css).toContain("font-family: var(--font-sans), system-ui, sans-serif");
    expect(css).not.toContain("font-synthesis: none");
    expect(css).toContain("@media (max-width: 767px)");
    expect(css).toContain("font-size: 1rem");
  });

  test("uses readable orange-filled control pairs", () => {
    for (const path of [
      "src/app/(public)/mice/page.client.js",
      "src/components/ui/AnimatedSubmitButton.js",
    ]) {
      const source = read(path);
      expect(source, path).toContain("bg-public-orange-ink");
      expect(source, path).toContain("text-public-surface");
      expect(source, path).not.toContain("bg-citius-orange text-brand-light");
    }
  });

  test("gives every dynamic public detail route meaningful instant content", () => {
    for (const path of PUBLIC_DETAIL_ROUTES) {
      const source = read(path);
      expect(source, path).toContain("PublicRouteLoadingShell");
      expect(source, path).not.toContain("fallback={null}");
    }
  });

  test("keeps the public instant lane credential-free and separate", () => {
    const packageJson = JSON.parse(read("package.json"));
    const config = read("playwright.public.config.ts");
    const spec = read("e2e/public/instant-navigation.spec.ts");
    expect(packageJson.devDependencies["@next/playwright"]).toBe("16.3.0");
    expect(packageJson.scripts["test:e2e:public-instant"]).toContain("playwright.public.config.ts");
    expect(config).not.toContain("globalSetup");
    expect(config).toContain(".scratch/e2e-public");
    expect(spec).toContain("instant(");
    expect(spec).not.toContain("E2E_STAFF_PASSWORD");
  });

  test("converts exactly the approved central tokens losslessly", () => {
    const css = read("src/app/globals.css");
    for (const [token, oklch, hex] of OKLCH_CONVERSIONS) {
      expect(css).toContain(`${token}: ${oklch};`);
      const expected = hexToRgb(hex);
      for (const [index, channel] of oklchToRgb(oklch).entries()) {
        expect(Math.abs(channel - expected[index]), `${token} ${oklch}`).toBeLessThanOrEqual(1);
      }
    }
  });
});
