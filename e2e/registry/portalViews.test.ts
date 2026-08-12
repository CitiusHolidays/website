import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PORTAL_ROUTES } from "../../src/lib/portal/portalRouteManifest";
import {
  PORTAL_E2E_COVERED_CELLS,
  PORTAL_E2E_MATRIX,
  portalE2eCellId,
  portalE2eCoverageSummary,
} from "./portalViews";

const root = resolve(import.meta.dir, "../..");

describe("portal e2e registry", () => {
  test("covers every portal view id from the app registry export list", () => {
    expect(Object.keys(PORTAL_E2E_MATRIX).sort()).toEqual(Object.keys(PORTAL_ROUTES).sort());
  });

  test("maps each claimed role/action cell to a live stable test title", () => {
    const ids = new Set<string>();
    for (const coverage of PORTAL_E2E_COVERED_CELLS) {
      const matrixCells = PORTAL_E2E_MATRIX[coverage.viewId].cells;
      expect(matrixCells).toContainEqual({ action: coverage.action, role: coverage.role });
      expect(existsSync(resolve(root, coverage.spec))).toBe(true);
      const source = readFileSync(resolve(root, coverage.spec), "utf8");
      expect(source).toContain(`test(${JSON.stringify(coverage.testTitle)}`);
      expect(source).not.toContain(`test.skip(${JSON.stringify(coverage.testTitle)}`);
      const id = portalE2eCellId(coverage.viewId, coverage);
      expect(ids.has(id), id).toBe(false);
      ids.add(id);
    }
  });

  test("discovers every claimed stable title through Playwright without running setup", () => {
    const result = spawnSync(
      "bunx",
      ["--no-install", "playwright", "test", "--list", "--reporter=line"],
      {
        cwd: root,
        encoding: "utf8",
        env: { ...process.env, E2E_STRICT: "0" },
      }
    );
    expect(result.status, result.stderr).toBe(0);
    for (const title of new Set(PORTAL_E2E_COVERED_CELLS.map((cell) => cell.testTitle))) {
      expect(result.stdout, title).toContain(title);
    }
  });

  test("reports exact covered/total view, action, role, and cell accounting", () => {
    const summary = portalE2eCoverageSummary();
    expect(summary).toEqual({
      actions: { covered: 13, total: 15 },
      cells: { covered: 19, total: 42 },
      roles: { covered: 10, total: 10 },
      views: { covered: 9, total: 25 },
    });
  });
});
