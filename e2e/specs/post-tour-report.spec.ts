import { execFileSync } from "node:child_process";
import { expect, type Page, type TestInfo, test } from "@playwright/test";
import { e2eStaffEmail, loadE2eStaffProfiles } from "../fixtures/staffProfiles";
import { openPortalAs } from "../helpers/auth";
import { holdToConfirmDelete } from "../helpers/confirm";
import { e2eConvexDeployment, e2eConvexRunArguments } from "../helpers/convexAssert";
import { E2E_SKIP_REASON, hasE2eCredentials } from "../helpers/skip";

const JC = "JC-E2E-WORKFLOW-EO";
const reportForm = (page: Page) => page.getByRole("form", { name: "Internal post-tour report" });
async function capture(page: Page, info: TestInfo, name: string) {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth))
    .toBeLessThanOrEqual(1);
  await page.screenshot({ fullPage: true, path: info.outputPath(`${name}.png`) });
}
function setLocalAdminFixture(admin: boolean) {
  if (e2eConvexDeployment() !== "local" || process.env.E2E_PROVISIONING_TARGET !== "development") {
    throw new Error("This fixture role check is local-only");
  }
  const profile = loadE2eStaffProfiles().find((row) => row.key === "admin");
  if (!profile) {
    throw new Error("Missing designated admin fixture");
  }
  const args = {
    email: e2eStaffEmail("admin"),
    emailNormalized: e2eStaffEmail("admin"),
    key: profile.key,
    name: profile.name,
    roles: admin ? [...profile.roles, "Admin"] : profile.roles,
  };
  const prefix = e2eConvexRunArguments("return null;").slice(0, -2);
  execFileSync("bunx", [...prefix, "crm/e2eSeed:upsertStaffProfile", JSON.stringify(args)], {
    stdio: ["ignore", "pipe", "pipe"],
  });
}
test("@workflow internal tour report preserves drafts, submits once, shares with staff and supports Admin archive/restore", async ({
  browser,
}, info) => {
  test.skip(!hasE2eCredentials(), E2E_SKIP_REASON);
  const { context, page } = await openPortalAs(browser, "operations");
  let reportUrl = "";
  try {
    await page.setViewportSize({ height: 1000, width: 1440 });
    await page.goto("/portal/job-cards");
    await page
      .getByRole("button", { exact: true, name: `Feedback for ${JC}` })
      .filter({ visible: true })
      .click();
    await capture(page, info, "jc-feedback-dropdown-desktop");
    await page.getByRole("menuitem", { exact: true, name: "Internal tour report" }).click();
    await expect(reportForm(page)).toBeVisible();
    reportUrl = page.url();
    await reportForm(page).getByLabel("Tour start date *", { exact: true }).fill("2026-10-01");
    await reportForm(page).getByLabel("Tour end date *", { exact: true }).fill("2026-10-04");
    await reportForm(page)
      .getByLabel("Tour Manager *", { exact: true })
      .fill("Synthetic Operations trip manager");
    await reportForm(page)
      .getByLabel("What were the three biggest highlights of the tour?", { exact: true })
      .fill("Clear airport arrivals, useful conference sessions, and a well-paced city visit.");
    await page.getByRole("button", { exact: true, name: "Earlier team notes" }).click();
    await page.getByRole("button", { exact: true, name: "Internal tour report" }).click();
    await expect(
      reportForm(page).getByLabel("What were the three biggest highlights of the tour?", {
        exact: true,
      })
    ).toHaveValue(
      "Clear airport arrivals, useful conference sessions, and a well-paced city visit."
    );
    const performance = reportForm(page).locator('[data-report-section="2"] select');
    for (let i = 0; i < 5; i += 1) {
      await performance.nth(i).selectOption(String([4, 5, 4, 3, 5][i]));
    }
    await reportForm(page).getByLabel("Itinerary / timing", { exact: true }).check();
    await reportForm(page)
      .getByLabel("Describe the most important issue encountered", { exact: true })
      .fill("The first transfer arrived late.");
    await reportForm(page)
      .getByLabel("How was the issue resolved?", { exact: true })
      .fill("Operations arranged a replacement vehicle.");
    await reportForm(page)
      .getByLabel("What should we do differently next time?", { exact: true })
      .fill("Confirm dispatch and the driver briefing the previous evening.");
    const suppliers = reportForm(page).locator('[data-report-section="4"] select');
    for (let i = 0; i < 6; i += 1) {
      await suppliers.nth(i).selectOption(["2", "4", "4", "4", "4", "na"][i]);
    }
    await reportForm(page)
      .getByLabel(
        "Hotel: What went wrong, and would you recommend this supplier for future groups?",
        { exact: true }
      )
      .fill("Rooms were late. Use again only with written early check-in.");
    await expect(
      reportForm(page).getByText("Restaurant / catering: What went wrong", { exact: false })
    ).toHaveCount(0);
    await reportForm(page)
      .getByLabel("Unexpected additional cost?", { exact: true })
      .selectOption("No");
    await reportForm(page)
      .getByLabel("Cost variation against approved budget?", { exact: true })
      .selectOption("No");
    await reportForm(page)
      .getByLabel("Refund or recovery pending?", { exact: true })
      .selectOption("Yes");
    await reportForm(page)
      .getByLabel("Billing and supplier closure completed?", { exact: true })
      .selectOption("Pending");
    await reportForm(page)
      .getByLabel("Amount, reason and responsible person for anything additional or pending", {
        exact: true,
      })
      .fill("INR 1,200 transfer refund. Operations owner will recover it.");
    await reportForm(page)
      .getByLabel("Overall tour rating, 1 to 10", { exact: true })
      .selectOption("8");
    await reportForm(page).getByLabel("Overall status", { exact: true }).selectOption("Good");
    await reportForm(page)
      .getByLabel("Repeat this destination and itinerary for a similar group?", { exact: true })
      .selectOption("Yes, with changes");
    await reportForm(page)
      .getByLabel("Top three learnings for future trips", { exact: true })
      .fill("Confirm rooms, allow transfer time, and brief hosts earlier.");
    await page.getByRole("button", { exact: true, name: "Save draft" }).click();
    await expect(
      page.getByText("Draft saved. No submission alert has been sent.", { exact: true })
    ).toBeVisible();
    await capture(page, info, "internal-report-draft-desktop");
    await page.setViewportSize({ height: 844, width: 390 });
    await capture(page, info, "internal-report-draft-phone");
    const hr = await openPortalAs(browser, "hr");
    try {
      await hr.page.goto(reportUrl);
      await expect(hr.page.getByRole("form", { name: "Internal post-tour report" })).toHaveCount(0);
    } finally {
      await hr.context.close();
    }
    await page.getByRole("button", { exact: true, name: "Submit report" }).click();
    await expect(
      page.getByText("Submitted report. All CRM staff can read this snapshot.", { exact: true })
    ).toBeVisible();
    await expect(page.getByRole("button", { exact: true, name: "Submit report" })).toHaveCount(0);
    await capture(page, info, "internal-report-submitted-phone");
  } finally {
    await context.close();
  }
  const hr = await openPortalAs(browser, "hr");
  try {
    await hr.page.goto(reportUrl);
    await expect(reportForm(hr.page)).toBeVisible();
    await expect(hr.page.getByRole("button", { exact: true, name: "Save draft" })).toHaveCount(0);
    await capture(hr.page, info, "internal-report-staff-read-desktop");
  } finally {
    await hr.context.close();
  }
  const directors = await openPortalAs(browser, "admin");
  try {
    await directors.page.goto(reportUrl);
    await expect(
      directors.page.getByRole("button", { exact: true, name: "Archive report" })
    ).toHaveCount(0);
  } finally {
    await directors.context.close();
  }
  // Reuse the existing synthetic credential; this local-only role fixture is restored below.
  setLocalAdminFixture(true);
  try {
    const admin = await openPortalAs(browser, "admin");
    try {
      await admin.page.goto(reportUrl);
      await admin.page.setViewportSize({ height: 844, width: 390 });
      await admin.page.getByRole("button", { exact: true, name: "Archive report" }).click();
      await expect(admin.page.getByRole("alertdialog")).toBeVisible();
      await capture(admin.page, info, "internal-report-admin-archive-confirm-phone");
      await holdToConfirmDelete(admin.page);
      await expect(
        admin.page.getByText("Archived reports, Admin only", { exact: true })
      ).toBeVisible();
      await admin.page.getByText("Archived reports, Admin only", { exact: true }).click();
      await capture(admin.page, info, "internal-report-admin-archive-phone");
      await admin.page.getByRole("button", { exact: true, name: "Restore report" }).click();
      await admin.page.getByTestId("portal-confirm-submit").click();
      await expect(
        admin.page.getByText("Submitted report. All CRM staff can read this snapshot.", {
          exact: true,
        })
      ).toBeVisible();
    } finally {
      await admin.context.close();
    }
  } finally {
    setLocalAdminFixture(false);
  }
});
