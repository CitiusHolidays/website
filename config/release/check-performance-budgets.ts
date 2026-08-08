import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import {
  evaluateStaffWorkspacePerformanceBudget,
  type StaffWorkspacePerformanceBudgetManifest,
  type StaffWorkspacePerformanceSample,
} from "./staff-workspace-performance-budget";

export interface PerformanceBudget {
  maxBytes: number;
  path: string;
  purpose: string;
}

export interface PerformanceBudgetManifest {
  budgets: PerformanceBudget[];
  schemaVersion: number;
}

export interface PerformanceBudgetFinding {
  actualBytes: number | undefined;
  maxBytes: number;
  path: string;
  purpose: string;
}

export interface StaffWorkspacePerformanceBaseline {
  environment: string;
  samples: StaffWorkspacePerformanceSample[];
  schemaVersion: number;
  sourceFiles: string[];
  sourceHash: string;
}

export function computeStaffWorkspacePerformanceSourceHash(root: string, sourceFiles: string[]) {
  const hash = createHash("sha256");
  for (const sourceFile of [...sourceFiles].sort()) {
    hash.update(sourceFile);
    hash.update("\0");
    hash.update(readFileSync(resolve(root, sourceFile)));
    hash.update("\0");
  }
  return hash.digest("hex");
}

export function isStaffWorkspacePerformanceBaselineFresh(
  baseline: StaffWorkspacePerformanceBaseline,
  currentSourceHash: string
) {
  return Boolean(
    baseline.sourceFiles.length > 0 &&
      baseline.sourceHash &&
      baseline.sourceHash === currentSourceHash
  );
}

export function evaluatePerformanceBudgets(
  manifest: PerformanceBudgetManifest,
  sizes: Record<string, number | undefined>
): PerformanceBudgetFinding[] {
  const findings: PerformanceBudgetFinding[] = [];
  for (const budget of manifest.budgets) {
    const actualBytes = sizes[budget.path];
    if (actualBytes === undefined || actualBytes > budget.maxBytes) {
      findings.push({
        actualBytes,
        maxBytes: budget.maxBytes,
        path: budget.path,
        purpose: budget.purpose,
      });
    }
  }
  return findings;
}

if (import.meta.main) {
  const root = resolve(import.meta.dir, "../..");
  const manifest = JSON.parse(
    readFileSync(resolve(import.meta.dir, "performance-budgets.json"), "utf8")
  ) as PerformanceBudgetManifest;
  const sizes = Object.fromEntries(
    manifest.budgets.map((budget) => {
      try {
        return [budget.path, statSync(resolve(root, budget.path)).size];
      } catch {
        return [budget.path, undefined];
      }
    })
  );
  const findings = evaluatePerformanceBudgets(manifest, sizes);
  const staffManifest = JSON.parse(
    readFileSync(resolve(import.meta.dir, "staff-workspace-performance-budgets.json"), "utf8")
  ) as StaffWorkspacePerformanceBudgetManifest;
  const staffBaseline = JSON.parse(
    readFileSync(resolve(import.meta.dir, "staff-workspace-performance-baseline.json"), "utf8")
  ) as StaffWorkspacePerformanceBaseline;
  const currentStaffSourceHash = computeStaffWorkspacePerformanceSourceHash(
    root,
    staffBaseline.sourceFiles
  );
  const staffBaselineFresh = isStaffWorkspacePerformanceBaselineFresh(
    staffBaseline,
    currentStaffSourceHash
  );
  const staffFindings = staffBaseline.samples.flatMap((sample) =>
    evaluateStaffWorkspacePerformanceBudget(staffManifest, sample)
  );
  if (findings.length > 0 || staffFindings.length > 0 || !staffBaselineFresh) {
    console.error("Performance budget check failed:");
    for (const finding of findings) {
      const actual = finding.actualBytes === undefined ? "missing" : `${finding.actualBytes} bytes`;
      console.error(
        `- ${finding.path} (${finding.purpose}) is ${actual}; budget is ${finding.maxBytes} bytes`
      );
    }
    for (const finding of staffFindings) {
      console.error(
        `- ${finding.target} ${finding.warm ? "warm" : "cold"} ${finding.metric} is ${finding.actual}; budget is ${finding.maximum}`
      );
    }
    if (!staffBaselineFresh) {
      console.error(
        `- authenticated Staff Workspace baseline is stale; expected source hash ${staffBaseline.sourceHash || "missing"}, current hash is ${currentStaffSourceHash}`
      );
    }
    process.exitCode = 1;
  } else {
    console.log(
      `Performance budget check passed: ${manifest.budgets.length} assets and ${staffBaseline.samples.length} authenticated Staff Workspace samples are within budget.`
    );
  }
}
