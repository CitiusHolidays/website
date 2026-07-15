import { describe, expect, test } from "bun:test";
import { file as bunFile, Glob } from "bun";

const sourceGlob = new Glob("src/**/*.{js,jsx,ts,tsx,css}");
const unguardedTransform =
  /(?<!fine-hover:)(?<!group-)(?:group-hover|hover):(?:-?translate|scale|rotate|skew)[^\s"'`]*/g;
const animatedPaletteOverlay =
  /portal-(?:native-dialog|command-backdrop|command-panel)[^"\n]*(?:animate-|transition-|duration-)/;

function readSources() {
  const files = Array.from(sourceGlob.scanSync({ cwd: process.cwd(), onlyFiles: true })).sort();
  return Promise.all(
    files.map(async (file) => ({
      contents: await bunFile(file).text(),
      file,
    }))
  );
}

describe("transition policy", () => {
  test("broad transitions are not used", async () => {
    const prohibitedUtility = ["transition", "all"].join("-");
    const violations = (await readSources())
      .filter(({ contents }) => contents.includes(prohibitedUtility))
      .map(({ file }) => file);

    expect(violations).toEqual([]);
  });

  test("hover transforms require a hover-capable fine pointer", async () => {
    const violations = (await readSources()).flatMap(({ contents, file }) =>
      Array.from(contents.matchAll(unguardedTransform), (match) => `${file}: ${match[0]}`)
    );

    expect(violations).toEqual([]);

    const globalCss = await bunFile("src/app/globals.css").text();
    expect(globalCss).toContain(
      "@custom-variant fine-hover (@media (hover: hover) and (pointer: fine))"
    );
  });

  test("reduced motion collapses CSS animation and transition duration", async () => {
    const globalCss = await bunFile("src/app/globals.css").text();

    expect(globalCss).toContain("@media (prefers-reduced-motion: reduce)");
    expect(globalCss).toContain("transition-duration: 1ms !important");
    expect(globalCss).toContain("animation-duration: 1ms !important");
  });

  test("command palette overlay mounts without open or close animation classes", async () => {
    const palette = await bunFile("src/components/portal/PortalCommandPalette.js").text();

    expect(palette).toContain('className="portal-native-dialog"');
    expect(palette).toContain('className="portal-command-backdrop"');
    expect(palette).toContain('className="portal-command-panel"');
    expect(palette).not.toMatch(animatedPaletteOverlay);
  });
});
