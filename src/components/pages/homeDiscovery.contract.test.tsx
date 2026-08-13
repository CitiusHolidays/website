import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const directContactLinkPattern = /<Link[^>]+href="\/contact"/s;

function read(path: string) {
  return readFileSync(path, "utf8");
}

describe("Home discovery and qualified contact actions", () => {
  test("keeps destination context visible without advertising a false card action", () => {
    const destinations = read("src/components/ui/TrendingDestinations.js");

    expect(destinations).toContain("destination.description");
    expect(destinations).toContain("aria-pressed");
    expect(destinations).toContain("min-h-[500px]");
    expect(destinations).not.toContain("cursor-pointer");
    expect(destinations).not.toContain("grid-template-rows");
    expect(destinations).not.toContain("group-hover:opacity-100");
    expect(destinations).not.toContain("motion/react");
  });

  test("fills the media-led service chapter without inventing per-card navigation", () => {
    const home = read("src/components/pages/HomeMainClient.js");
    const serviceCard = read("src/components/ui/ServiceCard.js");

    expect(home).toContain("lg:grid-flow-dense");
    expect(home).toContain("lg:grid-cols-12");
    expect(home).toContain('className: "sm:col-span-2 lg:col-span-6 lg:row-span-2');
    expect(home).toContain('className: "sm:col-span-2 lg:col-span-6"');
    expect(home.match(/className: "lg:col-span-3"/g)).toHaveLength(2);
    expect(home).toContain('href="/services"');
    expect(serviceCard).toContain("<article");
    expect(serviceCard).toContain("<Image");
    expect(serviceCard).not.toContain("href=");
    expect(serviceCard).not.toContain("cursor-pointer");
    expect(serviceCard).not.toContain("whileHover");
    expect(serviceCard).not.toContain("ArrowUpRight");
  });

  test("keeps every approved proof family inside one five-module credibility chapter", () => {
    const home = read("src/components/pages/HomeMainClient.js");

    expect(home).toContain('aria-labelledby="home-proof-heading"');
    expect(home.match(/data-proof-module=/g)).toHaveLength(5);
    for (const proof of [
      "PUBLIC_COMPANY_STATS",
      "ClientShowcase",
      "AwardsShowcase",
      "PUBLIC_COMPANY_STRENGTHS",
      "PartnerShowcase",
    ]) {
      expect(home).toContain(proof);
    }
  });

  test("uses one semantic contact CTA with a decorative trailing island", () => {
    const contactCta = read("src/components/ui/PublicContactCta.js");
    expect(contactCta).toContain("<Link");
    expect(contactCta).toContain('href = "/contact"');
    expect(contactCta).toContain("href={href}");
    expect(contactCta).toContain("<span>{children}</span>");
    expect(contactCta).toContain('aria-hidden="true"');
    expect(contactCta).not.toContain("aria-label=");
    expect(contactCta).toContain("rounded-full border font-semibold");
    expect(contactCta).toContain("border-transparent bg-public-surface");

    for (const path of [
      "src/components/layout/Header.js",
      "src/components/pages/HomeHeroClient.js",
      "src/components/pages/HomeMainClient.js",
    ]) {
      const source = read(path);
      expect(source, path).toContain("<PublicContactCta");
      expect(source, path).not.toMatch(directContactLinkPattern);
    }
  });

  test("keeps header geometry stable across its scroll threshold", () => {
    const header = read("src/components/layout/Header.js");

    expect(header).toContain("useMotionValueEvent");
    expect(header).toContain("h-10 w-[120px] origin-left");
    expect(header).toContain("width={120}");
    expect(header).not.toContain('layout="position"');
    expect(header).not.toContain("transition-[width");
    expect(header).not.toContain("transition-[background-color,box-shadow,padding]");
    expect(header).not.toContain("width={isScrolled");
    expect(header).not.toContain("pt-0");
  });
});
