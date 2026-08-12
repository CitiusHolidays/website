import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";

const source = readFileSync("src/components/portal/SelectableDataTable.tsx", "utf8");
const gridSource = readFileSync("src/lib/portal/portalDataGrid.ts", "utf8");
const paginationSource = readFileSync("src/lib/portal/paginatedRows.ts", "utf8");
const adapterSource = readFileSync("src/lib/portal/portalTanStackTableEquivalence.ts", "utf8");
const RENDER_TIME_TABLE_REF_ASSIGNMENT = /^\s*tableRef\.current\s*=\s*table;/m;

test("SelectableDataTable delegates table state to the private TanStack adapter", () => {
  expect(source).toContain(
    'import { usePortalTanStackTableEquivalence } from "@/lib/portal/portalTanStackTableEquivalence";'
  );
  expect(source).toContain("usePortalTanStackTableEquivalence({");
  expect(source).not.toContain("useBulkSelection");
  expect(source).not.toContain("sortPortalRows");
  expect(source).not.toContain("nextSortState");
  expect(source).not.toContain("shouldResetLoadedPage");
});

test("legacy generic table state is retired without removing presentation or cursor policy", () => {
  expect(existsSync("src/lib/portal/bulkSelection.js")).toBe(false);
  expect(gridSource).not.toContain("export function nextSortState");
  expect(gridSource).not.toContain("export function sortPortalRows");
  expect(gridSource).not.toContain("export function reconcilePortalSort");
  expect(gridSource).not.toContain("export function visiblePortalColumns");

  expect(gridSource).toContain("export function preparePortalColumns");
  expect(gridSource).toContain("export function desktopPinnedColumnClass");
  expect(paginationSource).toContain("export function shouldResetLoadedPage");
  expect(paginationSource).toContain("export function mergeFocusedRow");
});

test("TanStack reconciliation reads the latest table without assigning a ref during render", () => {
  expect(adapterSource).toContain("useEffectEvent");
  expect(adapterSource).not.toMatch(RENDER_TIME_TABLE_REF_ASSIGNMENT);
});
