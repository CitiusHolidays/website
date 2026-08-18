import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { FullResult, Reporter, TestCase, TestResult } from "@playwright/test/reporter";
import { portalE2eCoverageSummary } from "../registry/portalViews";

type SkipCategory =
  | "missing-credentials"
  | "missing-record-url"
  | "planned-matrix"
  | "product-precondition"
  | "uncategorized";

function skipCategory(test: TestCase): SkipCategory {
  const reason = test.annotations
    .filter((annotation) => annotation.type === "skip")
    .map((annotation) => annotation.description ?? "")
    .join(" ")
    .toLowerCase();
  if (/password|credential|staff profile|seed secret/.test(reason)) {
    return "missing-credentials";
  }
  if (/record url|pathenv|deep-link url/.test(reason)) {
    return "missing-record-url";
  }
  if (/planned|matrix|not implemented|coverage stub/.test(reason)) {
    return "planned-matrix";
  }
  if (/precondition|fixture|requires existing|order confirmed/.test(reason)) {
    return "product-precondition";
  }
  return "uncategorized";
}

export default class EvidenceReporter implements Reporter {
  private readonly counts = {
    failed: 0,
    passed: 0,
    skipCategories: {
      "missing-credentials": 0,
      "missing-record-url": 0,
      "planned-matrix": 0,
      "product-precondition": 0,
      uncategorized: 0,
    } satisfies Record<SkipCategory, number>,
    skipped: 0,
  };

  onTestEnd(test: TestCase, result: TestResult) {
    if (result.status === "skipped") {
      this.counts.skipped += 1;
      this.counts.skipCategories[skipCategory(test)] += 1;
    } else if (result.status === "passed") {
      this.counts.passed += 1;
    } else {
      this.counts.failed += 1;
    }
  }

  onEnd(result: FullResult) {
    const output = resolve(process.cwd(), ".scratch/playwright-results/evidence-summary.json");
    mkdirSync(dirname(output), { recursive: true });
    const summary = {
      ...this.counts,
      matrixCoverage: portalE2eCoverageSummary(),
      outcome: result.status,
      schemaVersion: 1,
    };
    writeFileSync(output, `${JSON.stringify(summary, null, 2)}\n`);
    console.log(
      `E2E evidence summary: ${summary.passed} passed, ${summary.failed} failed, ` +
        `${summary.skipped} skipped (${Object.entries(summary.skipCategories)
          .map(([category, count]) => `${category}=${count}`)
          .join(
            ", "
          )}); matrix cells ${summary.matrixCoverage.cells.covered}/${summary.matrixCoverage.cells.total}, ` +
        `views ${summary.matrixCoverage.views.covered}/${summary.matrixCoverage.views.total}, ` +
        `actions ${summary.matrixCoverage.actions.covered}/${summary.matrixCoverage.actions.total}, ` +
        `roles ${summary.matrixCoverage.roles.covered}/${summary.matrixCoverage.roles.total}`
    );
  }
}
