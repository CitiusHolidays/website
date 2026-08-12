// @ts-nocheck -- Bun's SSR contract uses react-dom/server without repo-wide React DOM types.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import LogoMarquee from "./LogoMarquee";
import NumberTicker from "./NumberTicker";

const oldImportPattern = /import\s+\w+\s+from\s+["']\.\.\/ui\/(LogoTicker|AnimatedCounter)["']/;

describe("canonical motion names", () => {
  test("documents the exact vocabulary already represented in the product", () => {
    const policy = readFileSync("docs/TRANSITION_POLICY.md", "utf8");

    for (const term of [
      "Origin-aware animation",
      "Direction-aware transition",
      "Accordion / Collapse",
      "Marquee",
      "Number ticker",
      "Hold to confirm",
    ]) {
      expect(policy).toContain(term);
    }
  });

  test("marquee keeps one accessible track and a motion-free wrapped fallback", () => {
    const source = readFileSync("src/components/ui/LogoMarquee.js", "utf8");
    const markup = renderToStaticMarkup(
      <LogoMarquee items={[<span key="acer">Acer</span>]} velocity={60} />
    );

    expect(markup.match(/Acer/g)).toHaveLength(2);
    expect(markup).toContain('aria-hidden="true"');
    expect(source).toContain("@media (prefers-reduced-motion: reduce)");
    expect(source).toContain("flex-wrap: wrap");
    expect(source).toContain("animation: none");
  });

  test("number ticker exposes the final value statically and disables its spring for reduced motion", () => {
    const source = readFileSync("src/components/ui/NumberTicker.js", "utf8");
    const markup = renderToStaticMarkup(<NumberTicker label="Years of Excellence" value={25} />);

    expect(markup).toContain("25+ Years of Excellence");
    expect(markup).toContain('aria-hidden="true"');
    expect(source).toContain("useReducedMotion");
    expect(source).toContain("useSyncExternalStore");
    expect(source).toContain("isHydrated && (shouldReduceMotion || isInView)");
    expect(source).toContain("duration: 0");
  });

  test("application consumers use canonical names while old modules remain compatibility-only", () => {
    for (const path of [
      "src/components/pages/HomeMainClient.js",
      "src/components/ui/ClientShowcase.js",
      "src/components/ui/PartnerShowcase.js",
    ]) {
      expect(readFileSync(path, "utf8")).not.toMatch(oldImportPattern);
    }
    expect(readFileSync("src/components/ui/LogoTicker.js", "utf8")).toContain(
      'export { default } from "./LogoMarquee"'
    );
    expect(readFileSync("src/components/ui/AnimatedCounter.js", "utf8")).toContain(
      'export { default } from "./NumberTicker"'
    );
  });
});
