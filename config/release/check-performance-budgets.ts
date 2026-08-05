import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

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
  if (findings.length > 0) {
    console.error("Performance budget check failed:");
    for (const finding of findings) {
      const actual = finding.actualBytes === undefined ? "missing" : `${finding.actualBytes} bytes`;
      console.error(
        `- ${finding.path} (${finding.purpose}) is ${actual}; budget is ${finding.maxBytes} bytes`
      );
    }
    process.exitCode = 1;
  } else {
    console.log(
      `Performance budget check passed: ${manifest.budgets.length} assets are within budget.`
    );
  }
}
