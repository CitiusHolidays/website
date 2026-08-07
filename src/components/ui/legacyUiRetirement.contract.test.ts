import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SOURCE_ROOT = join(ROOT, "src");
const SOURCE_FILE_PATTERN = /\.(?:js|jsx|ts|tsx)$/;
const NATIVE_DRAGGABLE_PROP_PATTERN = /\sdraggable=/;

function collectProductionSources(directory: string): Array<{ file: string; source: string }> {
  const sources: Array<{ file: string; source: string }> = [];
  for (const entry of readdirSync(directory)) {
    const absolute = join(directory, entry);
    if (statSync(absolute).isDirectory()) {
      sources.push(...collectProductionSources(absolute));
    } else if (SOURCE_FILE_PATTERN.test(entry) && !entry.includes(".test.")) {
      sources.push({ file: relative(ROOT, absolute), source: readFileSync(absolute, "utf8") });
    }
  }
  return sources;
}

const productionSources = collectProductionSources(SOURCE_ROOT);

function consumersOf(fragment: string): string[] {
  return productionSources
    .filter(({ source }) => source.includes(fragment))
    .map(({ file }) => file)
    .sort((left, right) => left.localeCompare(right));
}

describe("legacy UI retirement boundary", () => {
  test("removes zero-consumer portals, toast rendering, and obsolete type ownership", () => {
    expect(existsSync("src/components/motion-ui/toast-stack/index.tsx")).toBe(false);
    expect(existsSync("src/types/react-dom.d.ts")).toBe(false);

    const globalCss = readFileSync("src/app/globals.css", "utf8");
    expect(globalCss).not.toContain(".portal-native-dialog");
    expect(consumersOf('from "react-dom"')).toEqual([]);
    expect(consumersOf("motion-ui/toast-stack")).toEqual([]);
    expect(consumersOf("portal-native-dialog")).toEqual([]);
  });

  test("keeps the shared Staff field recipe as the only generic entity-field owner", () => {
    const modalForm = readFileSync("src/components/portal/PortalModalForm.js", "utf8");
    const duplicatedInputRecipe =
      "h-11 w-full rounded-xl border border-brand-border bg-brand-light px-3 text-sm outline-none transition focus:border-citius-blue focus:bg-white focus:ring-2 focus:ring-citius-blue/10";
    const duplicatedTextareaRecipe =
      "w-full rounded-xl border border-brand-border bg-brand-light px-3 py-2 text-sm outline-none transition focus:border-citius-blue focus:bg-white focus:ring-2 focus:ring-citius-blue/10";

    expect(modalForm).toContain('inputVariants({ surface: "staff" })');
    expect(modalForm).not.toContain(duplicatedInputRecipe);
    expect(modalForm).not.toContain(duplicatedTextareaRecipe);
  });

  test("keeps one private engine owner for migrated command, toast, menu, and Pipeline behavior", () => {
    const command = readFileSync("src/components/portal/PortalCommandPalette.js", "utf8");
    const toast = readFileSync("src/components/portal/PortalToast.js", "utf8");
    const menu = readFileSync("src/components/portal/PortalActionMenu.tsx", "utf8");
    const account = readFileSync("src/components/account/AccountSidebar.js", "utf8");
    const pipeline = readFileSync("src/components/portal/pipeline/PipelineView.tsx", "utf8");

    expect(command).toContain('from "@/components/ui/foundation/command"');
    expect(command).toContain("ControlledDialog");
    expect(command).not.toContain("activeIndex");
    expect(command).not.toContain("createPortal");
    expect(command).not.toContain("useFocusTrap");
    expect(command).not.toContain("lockBodyScroll");

    expect(toast).toContain('from "@/components/ui/foundation/toast"');
    expect(menu).toContain("BaseMenu.Root");
    expect(account).toContain("PortalActionMenu");
    expect(account).not.toContain('role="menu"');

    expect(pipeline).toContain("<DndContext");
    expect(pipeline).not.toContain("dataTransfer");
    expect(pipeline).not.toMatch(NATIVE_DRAGGABLE_PROP_PATTERN);
    expect(pipeline).not.toContain("onDragStart=");
    expect(pipeline).not.toContain("onDragOver=");
    expect(pipeline).not.toContain("onDrop=");
  });

  test("retains the public mobile overlay as the only legacy focus and body-lock consumer", () => {
    expect(consumersOf('from "@/components/motion-ui/overlay"')).toEqual([
      "src/components/layout/HeaderMobileMenu.js",
    ]);
    expect(consumersOf('from "@/lib/portal/lockBodyScroll"')).toEqual([
      "src/components/layout/HeaderMobileMenu.js",
    ]);

    const overlay = readFileSync("src/components/motion-ui/overlay/index.tsx", "utf8");
    expect(overlay).toContain("export function useFocusTrap");
    expect(overlay).not.toContain("export function useScrollLock");
    expect(overlay).not.toContain("export function Backdrop");
  });
});
