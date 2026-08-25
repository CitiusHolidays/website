// @ts-nocheck -- Bun's SSR contract uses react-dom/server without repo-wide React DOM types.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import LogoMarquee from "./LogoMarquee";
import NumberTicker from "./NumberTicker";

describe("Motion components", () => {
  test("Marquee keeps one accessible track and a compact motion-free fallback", () => {
    const source = readFileSync("src/components/ui/LogoMarquee.js", "utf8");
    const markup = renderToStaticMarkup(
      <LogoMarquee items={[<span key="acer">Acer</span>]} velocity={60} />
    );

    expect(markup.match(/Acer/g)).toHaveLength(2);
    expect(markup).toContain('aria-hidden="true"');
    expect(source).toContain("@media (prefers-reduced-motion: reduce)");
    expect(source).toContain("animation: none");
    expect(source).toContain("overflow-x: auto");
    expect(source).toContain('.logo-ticker-item[aria-hidden="true"]');
  });

  test("Number ticker exposes the final value statically and disables its spring for reduced motion", () => {
    const source = readFileSync("src/components/ui/NumberTicker.js", "utf8");
    const markup = renderToStaticMarkup(<NumberTicker label="Years of Excellence" value={25} />);

    expect(markup).toContain("25+ Years of Excellence");
    expect(markup).toContain('aria-hidden="true"');
    expect(source).toContain("useReducedMotion");
    expect(source).toContain("useSyncExternalStore");
    expect(source).toContain("isHydrated && (shouldReduceMotion || isInView)");
    expect(source).toContain("duration: 0");
  });
});
