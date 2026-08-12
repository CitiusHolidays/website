import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import {
  collectLocalImportClosure,
  hasExactPerformanceInputs,
  publicRuntimePerformanceInputs,
  staffWorkspacePerformanceInputs,
} from "./performance-inputs";

const temporaryRoots: string[] = [];

function fixtureRoot() {
  const root = mkdtempSync(resolve(tmpdir(), "citius-performance-inputs-"));
  temporaryRoots.push(root);
  mkdirSync(resolve(root, "src/components"), { recursive: true });
  writeFileSync(resolve(root, "src/entry.ts"), 'import "./components/card";\n');
  writeFileSync(resolve(root, "src/components/card.ts"), 'export { token } from "@/token";\n');
  writeFileSync(resolve(root, "src/token.ts"), 'export const token = "one";\n');
  return root;
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { force: true, recursive: true });
  }
});

describe("performance dependency inputs", () => {
  test("follows relative and aliased imports with stable ordering", () => {
    const root = fixtureRoot();
    expect(collectLocalImportClosure(root, ["src/entry.ts"])).toEqual([
      "src/components/card.ts",
      "src/entry.ts",
      "src/token.ts",
    ]);
    expect(collectLocalImportClosure(root, ["src/entry.ts"])).toEqual(
      collectLocalImportClosure(root, ["src/entry.ts"])
    );
  });

  test("fails closed when a declared root is absent", () => {
    const root = fixtureRoot();
    expect(() => collectLocalImportClosure(root, ["src/missing.ts"])).toThrow(
      "Performance input is missing"
    );
  });

  test("requires the recorded file identity to equal the current closure", () => {
    expect(hasExactPerformanceInputs(["a", "b"], ["a", "b"])).toBe(true);
    expect(hasExactPerformanceInputs(["a"], ["a", "b"])).toBe(false);
    expect(hasExactPerformanceInputs(["b", "a"], ["a", "b"])).toBe(false);
  });

  test("covers build, lock, harness, shell, lazy, view, and data owners", () => {
    const root = resolve(import.meta.dir, "../..");
    const staff = staffWorkspacePerformanceInputs(root);
    const publicRuntime = publicRuntimePerformanceInputs(root);
    for (const path of [
      "bun.lock",
      "next.config.mjs",
      "package.json",
      "e2e/specs/staff-workspace-performance.spec.ts",
      "src/components/portal/PortalShell.tsx",
      "src/components/portal/workspace/portalLazyViews.tsx",
      "src/components/portal/workspace/QueriesView.tsx",
      "src/components/portal/workspace/ProposalsView.tsx",
      "src/components/portal/workspace/operations/JobCardsView.tsx",
      "src/components/portal/workspace/usePortalWorkspaceData.ts",
    ]) {
      expect(staff).toContain(path);
    }
    for (const path of [
      "bun.lock",
      "next.config.mjs",
      "package.json",
      "scripts/public-runtime-performance.ts",
      "src/components/pages/HeroVideo.js",
    ]) {
      expect(publicRuntime).toContain(path);
    }
    expect(staff.some((path) => path.startsWith("docs/"))).toBe(false);
    expect(publicRuntime.some((path) => path.startsWith("docs/"))).toBe(false);
  });
});
