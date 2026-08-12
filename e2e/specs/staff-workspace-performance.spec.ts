import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import {
  evaluateStaffWorkspacePerformanceBudget,
  type StaffWorkspacePerformanceBudgetManifest,
  type StaffWorkspacePerformanceSample,
} from "../../config/release/staff-workspace-performance-budget";
import staffPerformanceBudgets from "../../config/release/staff-workspace-performance-budgets.json";
import type { E2eRoleProfileKey } from "../fixtures/staffProfiles";
import { openPortalAs } from "../helpers/auth";
import { E2E_SKIP_REASON, hasE2eCredentials } from "../helpers/skip";

interface PerformanceScenario {
  group: string;
  heading: string;
  href: string;
  link: string;
  role: E2eRoleProfileKey;
  target: "job-cards" | "proposals" | "queries";
}

const FIRST_CONTENT_PATTERN = /^(empty|row)$/;
const SAFE_SUBSCRIPTION_NAME_PATTERN = /^[A-Za-z0-9._-]+$/;

const SCENARIOS: PerformanceScenario[] = [
  {
    group: "Enquiries",
    heading: "All Sales Queries",
    href: "/portal/queries",
    link: "All Sales Queries",
    role: "sales",
    target: "queries",
  },
  {
    group: "Proposals",
    heading: "Proposals",
    href: "/portal/proposals",
    link: "Proposals",
    role: "contracting",
    target: "proposals",
  },
  {
    group: "Job Cards",
    heading: "Job Cards",
    href: "/portal/job-cards",
    link: "Job Cards",
    role: "operations",
    target: "job-cards",
  },
];

async function resetBrowserMetrics(page: import("@playwright/test").Page) {
  await page.evaluate(() => {
    performance.clearMarks();
    performance.clearMeasures();
    performance.clearResourceTimings();
  });
}

async function readPrivacySafeSample(page: import("@playwright/test").Page, warm: boolean) {
  return await page.evaluate((isWarm) => {
    const snapshot = (
      globalThis as typeof globalThis & {
        __CITIUS_PORTAL_PERFORMANCE__?: {
          applicationPayloadBytes: number;
          duplicateSubscriptions: number;
          firstContent: "empty" | "row";
          firstContentAt: number;
          logicalSubscriptions: number;
          pendingAt?: number;
          routeReadyAt?: number;
          startedAt: number;
          subscriptions: string[];
          target: string;
        };
      }
    ).__CITIUS_PORTAL_PERFORMANCE__;
    if (!(snapshot?.firstContentAt && snapshot.routeReadyAt)) {
      return null;
    }
    const routeResourceTransferBytes = performance
      .getEntriesByType("resource")
      .map((entry) => entry as PerformanceResourceTiming)
      .reduce((total, entry) => total + entry.transferSize, 0);
    return {
      applicationPayloadBytes: snapshot.applicationPayloadBytes,
      duplicateSubscriptions: snapshot.duplicateSubscriptions,
      firstContent: snapshot.firstContent,
      firstContentMs: snapshot.firstContentAt - snapshot.startedAt,
      logicalSubscriptions: snapshot.logicalSubscriptions,
      pendingMs: snapshot.pendingAt ? snapshot.pendingAt - snapshot.startedAt : null,
      routeReadyMs: snapshot.routeReadyAt - snapshot.startedAt,
      routeResourceTransferBytes,
      subscriptions: snapshot.subscriptions,
      target: snapshot.target,
      warm: isWarm,
    };
  }, warm);
}

async function openScenarioLink(
  page: import("@playwright/test").Page,
  scenario: PerformanceScenario
) {
  const link = page.getByRole("link", { exact: true, name: scenario.link }).first();
  if (!(await link.isVisible())) {
    await page.getByRole("button", { exact: true, name: scenario.group }).first().click();
  }
  await expect(link).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(new RegExp(`${scenario.href.replaceAll("/", "\\/")}(?:\\?.*)?$`));
  await expect(
    page.getByRole("heading", { exact: true, level: 2, name: scenario.heading })
  ).toBeVisible();
  await expect
    .poll(async () => (await readPrivacySafeSample(page, false))?.firstContent ?? null)
    .toMatch(FIRST_CONTENT_PATTERN);
}

test.describe("@performance authenticated Staff Workspace performance", () => {
  test.skip(!hasE2eCredentials(), E2E_SKIP_REASON);

  for (const scenario of SCENARIOS) {
    test(`${scenario.role}: Dashboard to ${scenario.heading} records cold and warm evidence`, async ({
      browser,
    }, testInfo) => {
      const { context, page } = await openPortalAs(browser, scenario.role);
      await page.goto("/portal");
      await resetBrowserMetrics(page);
      await openScenarioLink(page, scenario);
      const cold = await readPrivacySafeSample(page, false);

      await page.goto("/portal");
      const warmLink = page.getByRole("link", { exact: true, name: scenario.link }).first();
      if (!(await warmLink.isVisible())) {
        await page.getByRole("button", { exact: true, name: scenario.group }).first().click();
      }
      await warmLink.hover();
      await page.evaluate(async (target) => {
        const preload = (
          globalThis as typeof globalThis & {
            __CITIUS_PORTAL_PRELOADS__?: Partial<Record<string, Promise<unknown>>>;
          }
        ).__CITIUS_PORTAL_PRELOADS__?.[target];
        if (!preload) {
          throw new Error(`No tracked preload found for ${target}`);
        }
        await preload;
      }, scenario.target);
      await resetBrowserMetrics(page);
      await openScenarioLink(page, scenario);
      const warm = await readPrivacySafeSample(page, true);

      expect(cold).not.toBeNull();
      expect(warm).not.toBeNull();
      expect(cold).toMatchObject({ target: scenario.target, warm: false });
      expect(warm).toMatchObject({ target: scenario.target, warm: true });
      expect(cold?.subscriptions.every((name) => SAFE_SUBSCRIPTION_NAME_PATTERN.test(name))).toBe(
        true
      );
      expect(warm?.subscriptions.every((name) => SAFE_SUBSCRIPTION_NAME_PATTERN.test(name))).toBe(
        true
      );
      for (const sample of [cold, warm]) {
        const findings = evaluateStaffWorkspacePerformanceBudget(
          staffPerformanceBudgets as StaffWorkspacePerformanceBudgetManifest,
          sample as StaffWorkspacePerformanceSample
        );
        expect(findings, JSON.stringify(findings, null, 2)).toEqual([]);
      }

      await testInfo.attach(`staff-workspace-${scenario.target}-performance`, {
        body: JSON.stringify({ cold, warm }, null, 2),
        contentType: "application/json",
      });
      const runDir = process.env.E2E_PERFORMANCE_RUN_DIR;
      const revision = process.env.E2E_EVIDENCE_REVISION;
      if (runDir && revision) {
        mkdirSync(runDir, { recursive: true });
        writeFileSync(
          resolve(runDir, `${scenario.target}.json`),
          `${JSON.stringify({ cold, revision, target: scenario.target, warm }, null, 2)}\n`
        );
      }
      await context.close();
    });
  }
});
