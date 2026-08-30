import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type {
  FullConfig,
  FullResult,
  Reporter,
  TestCase,
  TestResult,
} from "@playwright/test/reporter";
import { validateE2ePreflight } from "../../config/e2e/preflight";
import { readApprovedE2eTarget } from "../../config/e2e/target-identity";
import { portalE2eDiscoverySummary, portalE2eExecutionSummary } from "../registry/portalViews";

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
  private authenticatedTarget: {
    revision: string;
    target: "development" | "preview";
    targetId: string;
  } | null = null;

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

  private readonly passedTestTitles = new Set<string>();

  onBegin(config: FullConfig) {
    if (process.env.E2E_STRICT !== "1") {
      return;
    }
    const baseUrl = String(config.projects[0]?.use?.baseURL ?? "http://localhost:3000");
    const preflight = validateE2ePreflight(process.env, baseUrl, true);
    if (preflight.mode !== "ready" || !preflight.target) {
      throw new Error("Strict authenticated E2E evidence requires a classified target");
    }
    const approved = readApprovedE2eTarget({
      baseUrl,
      convexSiteUrl: process.env.NEXT_PUBLIC_CONVEX_SITE_URL,
      manifestPath: process.env.E2E_TARGET_MANIFEST,
      target: preflight.target,
      targetId: process.env.E2E_TARGET_ID,
    });
    this.authenticatedTarget = {
      revision: approved.revision,
      target: approved.target,
      targetId: approved.id,
    };
  }

  onTestEnd(test: TestCase, result: TestResult) {
    if (result.status === "skipped") {
      this.counts.skipped += 1;
      this.counts.skipCategories[skipCategory(test)] += 1;
    } else if (result.status === "passed") {
      this.counts.passed += 1;
      this.passedTestTitles.add(test.title);
    } else {
      this.counts.failed += 1;
    }
  }

  onEnd(result: FullResult) {
    const output = resolve(process.cwd(), ".scratch/playwright-results/evidence-summary.json");
    mkdirSync(dirname(output), { recursive: true });
    const summary = {
      ...this.counts,
      authenticatedTarget: this.authenticatedTarget,
      evidenceClass: this.authenticatedTarget ? "authenticated-target" : "optional-discovery",
      matrixDiscovery: portalE2eDiscoverySummary(),
      matrixExecution: portalE2eExecutionSummary(this.passedTestTitles),
      outcome: result.status,
      schemaVersion: 2,
    };
    writeFileSync(output, `${JSON.stringify(summary, null, 2)}\n`);
    console.log(
      `E2E evidence summary: ${summary.passed} passed, ${summary.failed} failed, ` +
        `${summary.skipped} skipped (${Object.entries(summary.skipCategories)
          .map(([category, count]) => `${category}=${count}`)
          .join(
            ", "
          )}); executed matrix cells ${summary.matrixExecution.cells.executed}/${summary.matrixExecution.cells.total}, ` +
        `views ${summary.matrixExecution.views.executed}/${summary.matrixExecution.views.total}, ` +
        `actions ${summary.matrixExecution.actions.executed}/${summary.matrixExecution.actions.total}, ` +
        `roles ${summary.matrixExecution.roles.executed}/${summary.matrixExecution.roles.total}; ` +
        `registered discovery cells ${summary.matrixDiscovery.cells.registered}/${summary.matrixDiscovery.cells.total}`
    );
  }
}
