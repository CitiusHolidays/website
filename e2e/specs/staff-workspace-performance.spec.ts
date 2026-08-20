import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { fromPartial } from "@total-typescript/shoehorn";
import { rotatePerformanceTrialOrder } from "../../config/e2e/performance-trial-order";
import {
  evaluateStaffWorkspacePerformanceBudget,
  type StaffWorkspacePerformanceBudgetManifest,
  type StaffWorkspacePerformanceSample,
  type StaffWorkspacePerformanceTarget,
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
  target: StaffWorkspacePerformanceTarget;
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
  {
    group: "Enquiries",
    heading: "Contracting Dashboard",
    href: "/portal/contracting",
    link: "Contracting",
    role: "contracting",
    target: "contracting",
  },
  {
    group: "Finance",
    heading: "Finance",
    href: "/portal/finance",
    link: "Finance",
    role: "finance",
    target: "finance",
  },
  {
    group: "Ticketing",
    heading: "All Tickets",
    href: "/portal/tickets",
    link: "All Tickets",
    role: "ticketing",
    target: "tickets",
  },
  {
    group: "Operations",
    heading: "Hotel / Rooming List",
    href: "/portal/hotels",
    link: "Hotel / Rooming",
    role: "operations",
    target: "hotels",
  },
  {
    group: "Operations",
    heading: "Visa Tracking",
    href: "/portal/visa",
    link: "Visa Tracking",
    role: "operations",
    target: "visa",
  },
];

async function resetBrowserMetrics(page: import("@playwright/test").Page) {
  await page.evaluate(() => {
    performance.clearMarks();
    performance.clearMeasures();
    performance.clearResourceTimings();
  });
}

async function readPrivacySafeSample(
  page: import("@playwright/test").Page,
  warm: boolean,
  observationStartedAtUnixMs?: number
) {
  return await page.evaluate(
    ({ isWarm, observationStartedAt }) => {
      const snapshot = globalThis.__CITIUS_PORTAL_PERFORMANCE__;
      if (!(snapshot?.firstContentAt && snapshot.routeReadyAt)) {
        return null;
      }
      // SAFETY: getEntriesByType("resource") returns PerformanceResourceTiming entries in browsers.
      const routeResourceTransferBytes = performance
        .getEntriesByType("resource")
        .map((entry) => fromPartial<PerformanceResourceTiming>(entry))
        .reduce((total, entry) => total + entry.transferSize, 0);
      return {
        applicationPayloadBytes: snapshot.applicationPayloadBytes,
        duplicateSubscriptions: snapshot.duplicateSubscriptions,
        finishedAtUnixMs: Date.now(),
        firstContent: snapshot.firstContent,
        firstContentMs: snapshot.firstContentAt - snapshot.startedAt,
        logicalSubscriptions: snapshot.logicalSubscriptions,
        pendingMs: snapshot.pendingAt ? snapshot.pendingAt - snapshot.startedAt : null,
        routeReadyMs: snapshot.routeReadyAt - snapshot.startedAt,
        routeResourceTransferBytes,
        startedAtUnixMs: observationStartedAt ?? performance.timeOrigin + snapshot.startedAt,
        subscriptions: snapshot.subscriptions,
        target: snapshot.target,
        warm: isWarm,
      };
    },
    { isWarm: warm, observationStartedAt: observationStartedAtUnixMs }
  );
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
    .poll(async () => {
      const sample = await readPrivacySafeSample(page, false);
      return sample && sample.subscriptions.length > 0 ? sample.firstContent : null;
    })
    .toMatch(FIRST_CONTENT_PATTERN);
}

test.describe("@performance Authenticated Staff Workspace performance", () => {
  test.skip(!hasE2eCredentials(), E2E_SKIP_REASON);

  for (const scenario of rotatePerformanceTrialOrder(
    SCENARIOS,
    process.env.E2E_PERFORMANCE_TRIAL_INDEX
  )) {
    test(`${scenario.role}: Dashboard to ${scenario.heading} records cold and warm evidence`, async ({
      browser,
    }, testInfo) => {
      const coldObservationStartedAtUnixMs = Date.now();
      const { context, page } = await openPortalAs(browser, scenario.role);
      await page.goto("/portal");
      await resetBrowserMetrics(page);
      await openScenarioLink(page, scenario);
      const cold = await readPrivacySafeSample(page, false, coldObservationStartedAtUnixMs);

      const warmObservationStartedAtUnixMs = Date.now();
      await page.goto("/portal");
      const warmLink = page.getByRole("link", { exact: true, name: scenario.link }).first();
      if (!(await warmLink.isVisible())) {
        await page.getByRole("button", { exact: true, name: scenario.group }).first().click();
      }
      await resetBrowserMetrics(page);
      await warmLink.hover();
      await page.evaluate(async (target) => {
        const preload = globalThis.__CITIUS_PORTAL_PRELOADS__?.[target];
        if (!preload) {
          throw new Error(`No tracked preload found for ${target}`);
        }
        await preload;
      }, scenario.target);
      await openScenarioLink(page, scenario);
      const warm = await readPrivacySafeSample(page, true, warmObservationStartedAtUnixMs);

      expect(cold).not.toBeNull();
      expect(warm).not.toBeNull();
      expect(cold).toMatchObject({ target: scenario.target, warm: false });
      expect(warm).toMatchObject({ target: scenario.target, warm: true });
      expect(cold?.subscriptions.length).toBeGreaterThan(0);
      expect(warm?.subscriptions.length).toBeGreaterThan(0);
      expect(cold?.subscriptions.every((name) => SAFE_SUBSCRIPTION_NAME_PATTERN.test(name))).toBe(
        true
      );
      expect(warm?.subscriptions.every((name) => SAFE_SUBSCRIPTION_NAME_PATTERN.test(name))).toBe(
        true
      );
      for (const sample of [cold, warm]) {
        const findings = evaluateStaffWorkspacePerformanceBudget(
          // SAFETY: This test controls the asserted value at the framework boundary below.
          fromPartial<StaffWorkspacePerformanceBudgetManifest>(staffPerformanceBudgets),
          // SAFETY: This test controls the asserted value at the framework boundary below.
          fromPartial<StaffWorkspacePerformanceSample>(sample)
        );
        if (process.env.E2E_PERFORMANCE_DEFER_BUDGETS !== "1") {
          expect(findings, JSON.stringify(findings, null, 2)).toEqual([]);
        }
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
