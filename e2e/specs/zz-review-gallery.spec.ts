import { execFileSync } from "node:child_process";
import { expect, type Page, type TestInfo, test } from "@playwright/test";
import { e2eStaffEmail } from "../fixtures/staffProfiles";
import { openCustomerAccount, openPortalAs } from "../helpers/auth";
import { e2eConvexRunArguments } from "../helpers/convexAssert";
import { E2E_SKIP_REASON, hasE2eCredentials } from "../helpers/skip";

async function screenshot(page: Page, testInfo: TestInfo, name: string) {
  await expect
    .poll(() =>
      page.evaluate(
        () => Math.max(document.body.scrollWidth, document.documentElement.scrollWidth) - innerWidth
      )
    )
    .toBeLessThanOrEqual(1);
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`) });
}

function unavailableProviderReceipts() {
  const query =
    'return (await ctx.db.query("authEmailDeliveries").collect()).filter(row => row.failureCode === "provider_not_configured").length;';
  const output = execFileSync("bunx", e2eConvexRunArguments(query), {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  const value = Number(output);
  if (!(output && Number.isSafeInteger(value)) || value < 0) {
    throw new Error("Expected aggregate test-target auth receipt count");
  }
  return value;
}

test.describe("@review signed-in screenshot gaps", () => {
  test.skip(!hasE2eCredentials(), E2E_SKIP_REASON);

  test("Query table, command palette, columns and account menu", async ({ browser }, testInfo) => {
    const { context, page } = await openPortalAs(browser, "sales");
    try {
      await page.setViewportSize({ height: 1000, width: 1440 });
      await page.goto("/portal/queries");
      await expect(page.locator("[data-portal-route-component='QueriesView']")).toBeVisible();
      await expect(page.locator("tbody tr").first()).toBeVisible();
      await screenshot(page, testInfo, "queries-desktop");
      await page.getByRole("button", { name: /Open command palette/ }).click();
      await expect(page.getByRole("combobox", { name: "Search portal commands" })).toBeVisible();
      await screenshot(page, testInfo, "commands-desktop");
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: /Columns/ }).click();
      await screenshot(page, testInfo, "columns-desktop");
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: /Open account menu for/ }).click();
      await expect(page.getByRole("menu")).toBeVisible();
      await screenshot(page, testInfo, "account-menu-desktop");
      await page.keyboard.press("Escape");
      await page.setViewportSize({ height: 844, width: 390 });
      await screenshot(page, testInfo, "queries-phone");
      await page.getByRole("button", { name: /Open command palette/ }).click();
      await expect(page.getByRole("combobox", { name: "Search portal commands" })).toBeVisible();
      await screenshot(page, testInfo, "commands-phone");
    } finally {
      await context.close();
    }
  });

  test("Ticketing overview at desktop and phone widths", async ({ browser }, testInfo) => {
    const { context, page } = await openPortalAs(browser, "ticketing-head");
    try {
      await page.setViewportSize({ height: 1000, width: 1440 });
      await page.goto("/portal/ticketing");
      await expect(
        page.locator("[data-portal-route-component='TicketDashboardView']")
      ).toBeVisible();
      await screenshot(page, testInfo, "ticketing-overview-desktop");
      await page.setViewportSize({ height: 844, width: 390 });
      await screenshot(page, testInfo, "ticketing-overview-phone");
    } finally {
      await context.close();
    }
  });

  test("Customer profile draft keeps existing values and survives tab changes", async ({
    browser,
  }, testInfo) => {
    const { context, page } = await openCustomerAccount(browser);
    try {
      await page.setViewportSize({ height: 1000, width: 1440 });
      await page.goto("/account");
      await page.getByRole("button", { exact: true, name: "Profile" }).click();
      await page.getByRole("button", { exact: true, name: "Edit Details" }).click();
      const name = page.getByRole("textbox", { exact: true, name: "Full Name" });
      await expect(name).toHaveValue("E2E Customer");
      await name.fill("E2E Customer review draft");
      await screenshot(page, testInfo, "customer-profile-draft-desktop");
      await page.getByRole("button", { exact: true, name: "Settings" }).click();
      await page.getByRole("button", { exact: true, name: "Profile" }).click();
      await expect(name).toHaveValue("E2E Customer review draft");
      await page.setViewportSize({ height: 844, width: 390 });
      await screenshot(page, testInfo, "customer-profile-draft-phone");
      await page.getByRole("button", { exact: true, name: "Cancel" }).click();
      await expect(page.getByText("E2E Customer", { exact: true }).last()).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test("Local authentication renders the real reset email without a configured provider", async ({
    page,
  }, testInfo) => {
    const before = unavailableProviderReceipts();
    await page.goto("/auth/forgot-password");
    await page.getByRole("textbox", { name: /Email/ }).fill(e2eStaffEmail("sales"));
    await page.getByRole("button", { exact: true, name: "Send reset link" }).click();
    await expect(page.locator("#forgot-password-status")).toBeVisible();
    await expect.poll(unavailableProviderReceipts).toBeGreaterThan(before);
    await screenshot(page, testInfo, "auth-recovery-generic-result");
  });
});
