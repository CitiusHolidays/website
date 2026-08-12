import { describe, expect, test } from "bun:test";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const root = process.cwd();
const MOBILE_MENU_SCROLL_PATTERN = /min-h-0[^"]*flex-1/;
const MATERIAL_ROLE_PATTERN = /material-(structural|floating|decorative-glass)/;
const PUBLIC_TOKEN_PATTERN = /public-(paper|surface|night|ink|blue|orange|orange-ink|muted)/;
const LITERAL_BACKGROUND_PATTERN = /bg-\[#/;
const HEAVY_SHADOW_PATTERN = /shadow-(xl|2xl)/;
const HOVER_LIFT_PATTERN = /fine-hover:hover:-(translate|scale)|fine-hover:hover:scale/;
const EMOJI_PATTERN = /[\u{1F300}-\u{1FAFF}]/u;
const SIGN_IN_PATTERN = /<SignInDropdown/g;

function read(relativePath: string) {
  return readFileSync(join(root, relativePath), "utf8");
}

describe("public identity foundations", () => {
  test("pilgrimage slide indicators separate the 44px target from the visual bar", () => {
    for (const path of [
      "src/components/pilgrimage/SpiritualHero.js",
      "src/components/pilgrimage/TrailHeroSlideshow.js",
    ]) {
      const source = read(path);
      expect(source).toContain("min-h-11");
      expect(source).toContain("data-slide-indicator-bar");
      expect(source).toContain("aria-current={");
      expect(source).toContain("focus-visible:outline-public-orange");
    }
  });

  test("public mobile navigation is immediate, scrollable, and has one guest sign-in control", () => {
    const source = read("src/components/layout/HeaderMobileMenu.js");
    expect(source).not.toContain('from "motion/react"');
    expect(source).not.toContain("delay:");
    expect(source).not.toContain("initial={{");
    expect(source).toMatch(MOBILE_MENU_SCROLL_PATTERN);
    expect(source).toContain("overflow-y-auto");
    expect(source.match(SIGN_IN_PATTERN) ?? []).toHaveLength(1);
  });

  test("adaptive material roles preserve defaults and own preference fallbacks", () => {
    const globals = read("src/app/globals.css");
    for (const role of [
      ".material-structural",
      ".material-floating",
      ".material-decorative-glass",
    ]) {
      expect(globals).toContain(role);
    }
    expect(globals).toContain("@media (prefers-reduced-transparency: reduce)");
    expect(globals).toContain("@media (prefers-contrast: more)");

    const assigned = [
      "src/components/layout/Header.js",
      "src/components/portal/PortalShell.tsx",
      "src/components/portal/PortalListToolbar.js",
      "src/components/portal/PortalCommandPalette.js",
      "src/components/portal/SaveViewDialog.js",
      "src/components/account/AccountSidebar.js",
      "src/components/auth/AuthShell.js",
    ];
    for (const path of assigned) {
      expect(read(path)).toMatch(MATERIAL_ROLE_PATTERN);
    }
  });

  test("social cards are exact-ratio and metadata belongs to the correct identity", async () => {
    const socialCards = [
      "public/social/citius-holidays-social-card.jpg",
      "public/social/sacred-bharat-social-card.jpg",
    ];
    const imageMetadata = await Promise.all(
      socialCards.map((path) => sharp(join(root, path)).metadata())
    );
    for (const [index, path] of socialCards.entries()) {
      const metadata = imageMetadata[index];
      expect(metadata.width).toBe(1200);
      expect(metadata.height).toBe(630);
      expect(statSync(join(root, path)).size).toBeLessThan(1_500_000);
    }

    const rootLayout = read("src/app/layout.js");
    expect(rootLayout).toContain("/social/citius-holidays-social-card.jpg");
    expect(rootLayout).not.toContain("/gallery/aboutus.webp");

    const sacredPage = read("src/app/(public)/sacred-bharat/page.js");
    expect(sacredPage).toContain("/social/sacred-bharat-social-card.jpg");
    for (const field of ["title:", "description:", "height: 630", "width: 1200", "alt:"]) {
      expect(sacredPage).toContain(field);
    }
    expect(sacredPage).toContain("twitter:");
  });

  test("brand-family review board is review-only, attributable, and text-alternatived", () => {
    const board = read("docs/BRAND_VISUAL_WORLD_BOARD.md");
    expect(board).toContain("assets/citius-brand-family-overview.png");
    expect(board).toContain("## Rendered overview board text alternative");
    expect(board).toContain("Review-only");
    expect(board).toContain("Source and provenance");
  });

  test("Connect raster metadata matches the approved source file without inventing variants", () => {
    const dimensions = read("src/lib/citiusConnectLogo.js");
    expect(dimensions).toContain("CITIUS_CONNECT_LOGO_WIDTH = 546");
    expect(dimensions).toContain("CITIUS_CONNECT_LOGO_HEIGHT = 225");

    const usage = read("docs/CITIUS_CONNECT_LOGO.md");
    expect(usage).toContain("546 × 225");
    expect(usage).toContain("master vector");
    expect(usage).toContain("not approved");
  });

  test("Home keeps one hero hierarchy, one static grain recipe, and opaque services", () => {
    const hero = read("src/components/pages/HomeHeroClient.js");
    expect(hero).not.toContain("Premium Travel Partners");
    expect(hero).toContain("<PublicGrain");
    expect(hero.indexOf("<PublicGrain")).toBeGreaterThan(hero.indexOf("</m.div>"));

    const main = read("src/components/pages/HomeMainClient.js");
    expect(main).toContain("<PublicGrain");
    expect(main).toContain('href="/services"');

    const services = read("src/components/ui/ServiceCard.js");
    expect(services).toContain("public-service-card");
    expect(services).not.toContain("motion/react");
    expect(services).not.toContain("backdrop-blur");
    expect(services).not.toContain("ArrowUpRight");
    expect(services).not.toContain("whileHover");
    expect(services).not.toContain("blur-3xl");
  });

  test("reviewed marketing and Blog surfaces use the public editorial roles", () => {
    const publicIdentity = read("src/app/publicVisualIdentity.contract.test.ts");
    for (const path of [
      "src/app/(public)/about/page.client.js",
      "src/app/(public)/services/page.client.js",
      "src/app/(public)/mice/page.client.js",
      "src/app/(public)/gallery/page.client.js",
      "src/app/(public)/blog/page.client.js",
      "src/app/(public)/blog/[slug]/page.client.js",
      "src/app/(public)/contact/page.client.js",
    ]) {
      expect(publicIdentity).toContain(path);
      const source = read(path);
      expect(source).toContain("font-heading");
      expect(source).toMatch(PUBLIC_TOKEN_PATTERN);
      expect(source).not.toMatch(LITERAL_BACKGROUND_PATTERN);
    }

    for (const path of [
      "src/app/(public)/blog/page.client.js",
      "src/app/(public)/blog/[slug]/page.client.js",
    ]) {
      const source = read(path);
      expect(source).not.toMatch(HEAVY_SHADOW_PATTERN);
      expect(source).not.toMatch(HOVER_LIFT_PATTERN);
      expect(source).not.toMatch(EMOJI_PATTERN);
    }
  });
});
