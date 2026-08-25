import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const HOME_SOURCE = readFileSync("src/components/pages/HomeMainClient.js", "utf8");
const HOME_HERO_SOURCE = readFileSync("src/components/pages/HomeHeroClient.js", "utf8");
const SERVICE_CARD_SOURCE = readFileSync("src/components/ui/ServiceCard.js", "utf8");
const EMPTY_DYNAMIC_FALLBACK = /loading:\s*\(\)\s*=>\s*<div className=/;
const MANSAROVAR_CAMPAIGN = /mansarovar/i;
const OUT_OF_BOUNDARY_MEDIA = [
  "/gallery/account/",
  "/gallery/spiritual/",
  "/images/auth/",
  "/images/sacred-bharat/",
];

describe("Homepage media contract", () => {
  test("service and proof panels render real responsive images with shaped loading states", () => {
    expect(HOME_SOURCE).toContain("image: Goa");
    expect(HOME_SOURCE).toContain("image: GLOBAL_VOYAGES_IMAGE");
    expect(HOME_SOURCE).toContain("image: F1_RACE_IMAGE");
    expect(HOME_SOURCE).toContain("f56db0ac6b4d193018bdbc901da9e5602322fe98-4032x3024.png");
    expect(HOME_SOURCE).toContain("686c6e64e3b26f7e4eede8639b3b049c7e534748-3024x4032.jpg");
    expect(HOME_SOURCE).not.toContain("image: Japan");
    expect(HOME_SOURCE).toContain('image: "/gallery/mice.webp"');
    expect(HOME_SOURCE).not.toContain('image: "/gallery/sporting-events.webp"');
    expect(HOME_SOURCE).toContain('src="/gallery/aboutus.webp"');
    expect(HOME_SOURCE).toContain("<HomeModuleLoading");
    expect(HOME_SOURCE).toContain('aria-busy="true"');
    expect(HOME_SOURCE).not.toMatch(EMPTY_DYNAMIC_FALLBACK);

    expect(SERVICE_CARD_SOURCE).toContain('import Image from "next/image"');
    expect(SERVICE_CARD_SOURCE).toContain("src={image}");
    expect(SERVICE_CARD_SOURCE).toContain('sizes="(max-width: 639px) 100vw');

    expect(HOME_HERO_SOURCE).not.toMatch(MANSAROVAR_CAMPAIGN);
    expect(HOME_HERO_SOURCE).toContain('import Kashmir from "@/static/places/kashmir.webp"');
    expect(HOME_HERO_SOURCE).toContain("HeroVideo");
    expect(HOME_HERO_SOURCE).toContain('controlClassName="!right-auto');
    expect(HOME_HERO_SOURCE).toContain("poster={Kashmir.src}");
    for (const mediaPath of OUT_OF_BOUNDARY_MEDIA) {
      expect(HOME_SOURCE).not.toContain(mediaPath);
    }
  });
});
