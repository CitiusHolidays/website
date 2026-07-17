import { describe, expect, test } from "bun:test";
import { file as bunFile, Glob } from "bun";

const sourceGlob = new Glob("src/**/*.{js,jsx,ts,tsx,css}");
const unguardedTransform =
  /(?<!fine-hover:)(?<!group-)(?:group-hover|hover):(?:-?translate|scale|rotate|skew)[^\s"'`]*/g;
const animatedPaletteOverlay =
  /portal-(?:native-dialog|command-backdrop|command-panel)[^"\n]*(?:animate-|transition-|duration-)/;

const PORTAL_GPU_MOTION_TARGETS = [
  "src/components/portal/PortalToast.js",
  "src/components/portal/entityModal/EntityModalShell.js",
  "src/components/portal/workspace/modals/spreadsheetModalShell.tsx",
  "src/components/portal/PortalConfirmDialog.js",
  "src/components/portal/PortalListToolbar.js",
] as const;

/** Motion x/y/scale/scaleY shorthand props — use transform strings instead. */
const motionShorthandProp = /\b(?:^|[,{]\s*)(?:x|y|scaleY|scale)\s*:/m;
const toastLayoutProp = /\blayout\b/;
const toastUpwardExit = /\by:\s*-/;
const confirmBackdropFade = /animate=\{\{\s*opacity:\s*1/;
const toolbarScaleYShorthand = /scaleY:\s*1/;

function collectMotionShorthandViolations(contents: string, file: string) {
  const blocks = contents.match(/(?:animate|initial|exit)=\{\{[\s\S]*?\}\}/g);
  if (!blocks) {
    return [];
  }
  return blocks.flatMap((block) =>
    motionShorthandProp.test(block) ? [`${file}: ${block.replace(/\s+/g, " ").slice(0, 80)}…`] : []
  );
}

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

  test("portal CRM motion surfaces avoid Motion x/y/scale shorthand", async () => {
    const violations = (
      await Promise.all(
        PORTAL_GPU_MOTION_TARGETS.map(async (file) => {
          const contents = await bunFile(file).text();
          return collectMotionShorthandViolations(contents, file);
        })
      )
    ).flat();

    expect(violations).toEqual([]);
  });

  test("portal toast uses GPU transform strings and symmetric bottom-edge path", async () => {
    const toast = await bunFile("src/components/portal/PortalToast.js").text();

    expect(toast).toContain("useReducedMotion");
    expect(toast).toContain("transform:");
    expect(toast).toContain("translateY(100%)");
    expect(toast).not.toMatch(toastLayoutProp);
    expect(toast).not.toMatch(toastUpwardExit);
  });

  test("portal modal shells branch reduced motion and use transform strings", async () => {
    const entityModal = await bunFile(
      "src/components/portal/entityModal/EntityModalShell.js"
    ).text();
    const importModal = await bunFile(
      "src/components/portal/workspace/modals/spreadsheetModalShell.tsx"
    ).text();
    const confirm = await bunFile("src/components/portal/PortalConfirmDialog.js").text();

    for (const source of [entityModal, importModal, confirm]) {
      expect(source).toContain("useReducedMotion");
      expect(source).toContain("transform:");
    }
    expect(confirm).toMatch(confirmBackdropFade);
  });

  test("portal list toolbar filter expand uses transform not scaleY shorthand", async () => {
    const toolbar = await bunFile("src/components/portal/PortalListToolbar.js").text();

    expect(toolbar).toContain('transform: "scaleY(1)"');
    expect(toolbar).not.toMatch(toolbarScaleYShorthand);
  });

  test("portal shell sidebar active indicator avoids layoutId spring", async () => {
    const shell = await bunFile("src/components/portal/PortalShell.tsx").text();

    expect(shell).not.toContain('layoutId="portalNavActive"');
  });
});
