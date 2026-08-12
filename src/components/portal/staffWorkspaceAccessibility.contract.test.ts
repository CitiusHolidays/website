import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");
const TEMPLATE_DOLLAR = String.fromCodePoint(36);

describe("Staff Workspace accessibility contracts", () => {
  test("popover motion originates from the trigger-aligned corner", () => {
    const popover = read("src/components/portal/PortalPopover.tsx");

    expect(popover).toContain(
      'const popupOriginClass = align === "right" ? "origin-top-right" : "origin-top-left"'
    );
    expect(popover).toContain(`${TEMPLATE_DOLLAR}{popupOriginClass}`);
  });

  test("one portal chrome-height token positions header, sidebar, main, and sticky toolbar", () => {
    const globals = read("src/app/globals.css");
    const shell = read("src/components/portal/PortalShell.tsx");
    const toolbar = read("src/components/portal/PortalListToolbar.js");

    expect(globals).toContain("--portal-chrome-height: 4.25rem");
    expect(shell.match(/var\(--portal-chrome-height\)/g)?.length).toBeGreaterThanOrEqual(4);
    expect(toolbar).toContain("top-[var(--portal-chrome-height)]");
    expect(toolbar).not.toContain("sticky top-16");
  });

  test("reactive numeric surfaces use stable-width numerals", () => {
    const targets = [
      "src/components/portal/SelectableDataTable.tsx",
      "src/components/portal/workspace/admin/LeaveView.tsx",
      "src/components/portal/workspace/modals/PassengerImportModal.tsx",
      "src/components/portal/workspace/modals/ImportReconciliationModal.tsx",
      "src/components/sacredBharat/LevelBadge.js",
    ];

    for (const target of targets) {
      expect(read(target), target).toContain("tabular-nums");
    }
  });

  test("automatic tabs and the automatic pipeline selector do not use layout springs", () => {
    const tabs = read("src/components/portal/PortalTabs.tsx");
    const pipeline = read("src/components/portal/pipeline/PipelineView.tsx");

    expect(tabs).toContain('activateOnFocus={selectionMode === "automatic"}');
    expect(tabs).toContain('<span className="absolute inset-0');
    expect(tabs).not.toContain("layoutId={`portal-tabs-indicator-");
    expect(tabs).not.toContain('type: "spring"');
    expect(tabs).not.toContain("automatic ? 0.12");
    expect(pipeline).not.toContain('layoutId="pipeline-mode-indicator"');
  });
});
