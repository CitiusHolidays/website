import { describe, expect, test } from "bun:test";
import { file as bunFile, Glob } from "bun";
import { scanTransitionPolicySource } from "../config/release/transition-policy-scanner";

const sourceGlob = new Glob("src/**/*.{js,jsx,ts,tsx,css}");
const TEST_FILE_PATTERN = /\.(?:test|spec)\.[^.]+$/;
const unguardedTransform =
  /(?<!fine-hover:)(?<!group-)(?:group-hover|hover):(?:-?translate|scale|rotate|skew)[^\s"'`]*/g;
const animatedPaletteOverlay =
  /portal-(?:native-dialog|command-backdrop|command-panel)[^"\n]*(?:animate-|transition-|duration-)/;

const PORTAL_GPU_MOTION_TARGETS = [
  "src/components/portal/PortalPopover.tsx",
  "src/components/portal/PortalShell.tsx",
  "src/components/portal/PortalToast.js",
  "src/components/portal/entityModal/EntityModalShell.js",
  "src/components/portal/workspace/modals/spreadsheetModalShell.tsx",
  "src/components/portal/workspace/modals/CommercialFilesModal.tsx",
  "src/components/portal/PortalConfirmDialog.js",
  "src/components/portal/PortalListToolbar.js",
] as const;

const INTENTIONAL_RENDER_TIER_EXCEPTIONS = [
  "src/app/(public)/sacred-bharat/trails/[slug]/page.client.js::layout-transition::width",
  "src/components/auth/AuthLoginForm.js::layout-transition::width",
  "src/components/layout/Header.js::layout-transition::height",
  "src/components/layout/Header.js::layout-transition::padding",
  "src/components/layout/Header.js::layout-transition::padding",
  "src/components/layout/Header.js::layout-transition::width",
  "src/components/layout/Header.js::layout-transition::width",
  "src/components/pilgrimage/SpiritualHero.js::layout-transition::width",
  "src/components/pilgrimage/TrailHeroSlideshow.js::layout-transition::width",
  "src/components/sacredBharat/TrailCardGrid.js::layout-transition::width",
  "src/components/ui/AnimatedSubmitButton.js::layout-motion::position",
  "src/components/ui/AnimatedSubmitButton.js::layout-motion::position",
  "src/components/ui/AnimatedSubmitButton.js::layout-motion::position",
] as const;

const TEMPORARY_RENDER_TIER_DEBT = [
  "src/components/ui/TrendingDestinations.js::layout-transition::grid-template-rows",
] as const;

/** Motion x/y/scale/scaleY shorthand props — use transform strings instead. */
const motionShorthandProp = /\b(?:^|[,{]\s*)(?:x|y|scaleY|scale)\s*:/m;
const confirmAnimatePresence = /AnimatePresence/;
const confirmExitProp = /exit=\{\{/;
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
  const files = Array.from(sourceGlob.scanSync({ cwd: process.cwd(), onlyFiles: true }))
    .filter((file) => !TEST_FILE_PATTERN.test(file))
    .sort((left, right) => left.localeCompare(right));
  return Promise.all(
    files.map(async (file) => ({
      contents: await bunFile(file).text(),
      file,
    }))
  );
}

describe("transition policy", () => {
  test("parser-backed policy distinguishes broad, layout, and global animation hazards", () => {
    const violations = scanTransitionPolicySource({
      contents: `
        export function Fixture() {
          return <>
            <div className="transition transition-all transition-[grid-template-rows] will-change-transform" />
            <m.div animate={{ letterSpacing: "0.5em" }} initial={{ letterSpacing: "0.2em" }} />
          </>
        }
        document.documentElement.style.setProperty("--motion-progress", String(progress));
      `,
      file: "fixture.tsx",
    });

    expect(violations.map(({ kind }) => kind)).toEqual([
      "bare-transition",
      "broad-transition",
      "layout-transition",
      "permanent-will-change",
      "layout-motion",
      "layout-motion",
      "global-css-variable-motion",
    ]);
  });

  test("intentional progress and static geometry do not false-positive", () => {
    const violations = scanTransitionPolicySource({
      allowedLayoutProperties: new Set(["width"]),
      contents: `
        export function Progress({ value }) {
          const prose = "transition transition-all";
          return <div style={{ width: 320 }}>
            <m.div
              className="transition-[width]"
              style={{ width: value + "%" }}
              transition={{ width: { duration: 0.2 } }}
            />
          </div>
        }
      `,
      file: "fixture-progress.tsx",
    });

    expect(violations).toEqual([]);
  });

  test("the render-tier census accepts only intentional exceptions and ratcheted downstream debt", async () => {
    const violations = (await readSources())
      .flatMap(({ contents, file }) => scanTransitionPolicySource({ contents, file }))
      .filter(({ kind }) =>
        [
          "global-css-variable-motion",
          "layout-motion",
          "layout-transition",
          "permanent-will-change",
        ].includes(kind)
      )
      .map(({ detail, file, kind }) => `${file}::${kind}::${detail}`)
      .sort((left, right) => left.localeCompare(right));
    const approved = [...INTENTIONAL_RENDER_TIER_EXCEPTIONS, ...TEMPORARY_RENDER_TIER_DEBT].sort(
      (left, right) => left.localeCompare(right)
    );

    expect(violations).toEqual(approved);
  });

  test("executable application class strings contain no broad transition utility", async () => {
    const violations = (await readSources()).flatMap(({ contents, file }) =>
      scanTransitionPolicySource({ contents, file }).filter(
        ({ kind }) => kind === "bare-transition" || kind === "broad-transition"
      )
    );

    expect(violations).toEqual([]);
  });

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
    const overlayFrame = await bunFile("src/components/portal/usePortalOverlayFrame.js").text();

    expect(palette).toContain('viewportClassName="portal-command-overlay"');
    expect(palette).toContain('backdropClassName="portal-command-backdrop"');
    expect(palette).toContain('panelClassName="portal-command-panel"');
    expect(palette).toContain("ControlledDialog");
    expect(palette).toContain("<Command");
    expect(palette).not.toMatch(animatedPaletteOverlay);
    expect(palette).not.toContain("createPortal");
    expect(palette).not.toContain("useFocusTrap");
    expect(palette).not.toContain("lockBodyScroll");
    expect(palette).not.toContain("<Command.Dialog");
    expect(overlayFrame).toContain('getElementById("portal-main")');
    expect(overlayFrame).toContain("frameStyle");
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

  test("portal toast stack delegates transient rendering and reduced motion to Sonner", async () => {
    const portalToast = await bunFile("src/components/portal/PortalToast.js").text();
    const globalCss = await bunFile("src/app/globals.css").text();

    expect(portalToast).toContain('from "@/components/ui/foundation/toast"');
    expect(portalToast).toContain("<Toaster");
    expect(portalToast).toContain("zIndex: PORTAL_Z_INDEX.toast");
    expect(portalToast).toContain("visibleToasts={MAX_VISIBLE_TOASTS}");
    expect(portalToast).not.toContain("motion-ui/toast-stack");
    expect(portalToast).not.toContain("useMotionUITransition");
    expect(globalCss).toContain(".portal-toast-safe-area [data-sonner-toast]");
  });

  test("animated portal modal shells use transform strings while Base confirm stays static", async () => {
    const entityModal = await bunFile(
      "src/components/portal/entityModal/EntityModalShell.js"
    ).text();
    const importModal = await bunFile(
      "src/components/portal/workspace/modals/spreadsheetModalShell.tsx"
    ).text();
    const confirm = await bunFile("src/components/portal/PortalConfirmDialog.js").text();

    for (const source of [entityModal, importModal]) {
      expect(source).toContain("useReducedMotion");
      expect(source).toContain("transform:");
    }
    expect(confirm).not.toContain("useReducedMotion");
    expect(confirm).not.toContain("transitionStatus");
    expect(confirm).not.toContain("popupStyle=");
    expect(confirm).not.toContain("backdropStyle=");
    expect(confirm).toMatch(confirmAnimatePresence);
    expect(confirm).toMatch(confirmExitProp);
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

  test("portal dashboard disclosures and Staff selection avoid layout animation", async () => {
    const dashboardDisclosure = await bunFile(
      "src/components/portal/dashboard/DashboardCollapsibleSection.js"
    ).text();
    const dashboardView = await bunFile("src/components/portal/dashboard/DashboardView.js").text();
    const portalTabs = await bunFile("src/components/portal/PortalTabs.tsx").text();
    const pipeline = await bunFile("src/components/portal/pipeline/PipelineView.tsx").text();
    const modeSelector = pipeline.slice(
      pipeline.indexOf("function PipelineModeButton"),
      pipeline.indexOf("interface PipelineCardProps")
    );

    for (const source of [dashboardDisclosure, dashboardView]) {
      expect(source).not.toContain("grid-template-rows");
      expect(source).not.toContain("grid-rows-");
      expect(source).toContain("aria-controls");
    }
    expect(portalTabs).not.toContain('from "motion/react"');
    expect(modeSelector).not.toContain("<m.");
    expect(modeSelector).not.toContain("transition-colors");
  });

  test("portal overlay families use the shared reversible lifecycle", async () => {
    const applicationDialog = await bunFile("src/components/ui/application-dialog.tsx").text();
    const popover = await bunFile("src/components/portal/PortalPopover.tsx").text();
    const shell = await bunFile("src/components/portal/PortalShell.tsx").text();
    const commercialFiles = await bunFile(
      "src/components/portal/workspace/modals/CommercialFilesModal.tsx"
    ).text();

    for (const source of [popover, shell, commercialFiles]) {
      expect(source).toContain("portalOverlayMotion");
    }
    expect(shell).not.toContain("<AnimatePresence>");
    expect(applicationDialog).not.toContain("actionsRef.current?.unmount()");
    expect(applicationDialog).toContain('aria-hidden={open ? undefined : "true"}');
    expect(applicationDialog).toContain("inert={open ? undefined : true}");
  });
});
