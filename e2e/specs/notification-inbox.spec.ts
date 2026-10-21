import { type Browser, expect, type Page, type TestInfo, test } from "@playwright/test";
import { E2E_ROLE_PROFILE_KEYS } from "../fixtures/staffProfiles";
import { openPortalAs } from "../helpers/auth";
import { uniqueE2eLabel } from "../helpers/chainState";
import { entityModal, modalCombobox, modalField, saveEntityModal } from "../helpers/modal";
import { selectedOptionLabel, selectOptionByMatchingLabel } from "../helpers/select";
import { E2E_SKIP_REASON, hasE2eCredentials } from "../helpers/skip";
import { QueriesPage } from "../pages/queriesPage";

function inbox(page: Page) {
  return page.getByRole("region", { name: "Your notifications" });
}

function contractingLink(page: Page) {
  return page.locator('a.portal-nav-link[href="/portal/contracting"]').filter({ visible: true });
}

async function createQuery(page: Page, clientName: string, ticketingScope = "Not required") {
  const queries = new QueriesPage(page);
  await queries.open();
  await queries.createQuery(clientName, "E2E Contracting", ticketingScope);
  await modalField(page, "Destination").fill("Jaipur");
  await modalField(page, "Notes").pressSequentially(
    "Synthetic local acceptance enquiry. Preserve these notes."
  );
  await saveEntityModal(page);
  const row = queries.queryRow(clientName);
  await expect(row).toBeVisible();
  const code = await row.getByText(/Q-\d+/).first().textContent();
  expect(code).toMatch(/Q-\d+/);
  return code?.trim() ?? "";
}

async function expectExactAudience(browser: Browser, code: string) {
  const recipients = new Set(["admin", "contracting", "ticketing-head", "leave-head"]);
  for (const role of E2E_ROLE_PROFILE_KEYS) {
    const { context, page } = await openPortalAs(browser, role);
    try {
      await openInbox(page);
      await inbox(page).getByRole("button", { exact: true, name: "All" }).click();
      const update = inbox(page).getByRole("button").filter({ hasText: code });
      await expect(update, `${role} query-intake audience`).toHaveCount(
        recipients.has(role) ? 1 : 0
      );
    } finally {
      await context.close();
    }
  }
}

async function takeTicketingWork(browser: Browser, code: string, testInfo: TestInfo) {
  const { context, page } = await openPortalAs(browser, "ticketing-head");
  try {
    await openInbox(page);
    await inbox(page).getByRole("button", { exact: true, name: "All" }).click();
    await inbox(page).getByRole("button").filter({ hasText: code }).click();
    await expect(page).toHaveURL(/open=assignQueryTeams/);
    await selectOptionByMatchingLabel(modalCombobox(page, "Ticketing SPOC"), "E2E Ticketing Head");
    await page.screenshot({ path: testInfo.outputPath("head-self-assignment-desktop.png") });
    await saveEntityModal(page);
    await page.goto("/portal/queries");
    await page
      .locator("tr")
      .filter({ hasText: code })
      .getByRole("button", { exact: true, name: "Assign teams" })
      .click();
    await expect
      .poll(() => selectedOptionLabel(modalCombobox(page, "Ticketing SPOC")))
      .toBe("E2E Ticketing Head");
  } finally {
    await context.close();
  }
}

async function openInbox(page: Page) {
  await page.goto("/portal/activity");
  await expect(inbox(page).getByRole("button", { name: /^Unread(?: · \d+)?$/ })).toBeVisible();
  await expect(inbox(page).getByRole("status", { name: "Loading notifications" })).toBeHidden();
  await expect(page.getByText(/^0 authorized records loaded; all available records/)).toHaveCount(
    0
  );
}

test.describe("@workflow notification inbox and sidebar activity", () => {
  test.skip(!hasE2eCredentials(), E2E_SKIP_REASON);

  test("assigned updates stay personal; visits clear activity independently of workload and inbox reads", async ({
    browser,
  }, testInfo) => {
    test.setTimeout(180_000);
    const sales = await openPortalAs(browser, "sales");
    const contracting = await openPortalAs(browser, "contracting");
    const hr = await openPortalAs(browser, "hr");
    const pageErrors: string[] = [];
    sales.page.on("pageerror", (error) => pageErrors.push(error.message));
    contracting.page.on("pageerror", (error) => pageErrors.push(error.message));
    try {
      await openInbox(contracting.page);
      const unreadBefore = await inbox(contracting.page).locator("li").count();
      const link = contractingLink(contracting.page);
      if (!(await link.isVisible())) {
        await contracting.page.getByRole("button", { name: /^Enquiries/ }).click();
      }
      await expect(link).toBeVisible();

      const firstCode = await createQuery(
        sales.page,
        uniqueE2eLabel("E2E Cedar Conference"),
        "Both"
      );
      await expectExactAudience(browser, firstCode);
      await expect(link.getByText("New activity", { exact: true })).toBeVisible();
      const countBefore = await link
        .locator("[title$='work items need attention']")
        .getAttribute("title");
      expect(countBefore).toMatch(/\d+ work items need attention/);
      await link.hover();
      await expect(link.getByText("New activity", { exact: true })).toBeVisible();
      await contracting.page.reload();
      await expect(link.getByText("New activity", { exact: true })).toBeVisible();
      await contracting.page.screenshot({
        path: testInfo.outputPath("inbox-sidebar-new-desktop.png"),
      });

      await link.click();
      await expect(contracting.page).toHaveURL(/\/portal\/contracting$/);
      await expect(link.getByText("New activity", { exact: true })).toHaveCount(0);
      await expect(link.locator("[title$='work items need attention']")).toHaveAttribute(
        "title",
        countBefore ?? ""
      );
      await openInbox(contracting.page);
      await expect(
        inbox(contracting.page).getByRole("button", {
          exact: true,
          name: `Unread · ${unreadBefore + 1}`,
        })
      ).toBeVisible();

      const secondCode = await createQuery(sales.page, uniqueE2eLabel("E2E Cedar Follow-up"));
      await expect(link.getByText("New activity", { exact: true })).toBeVisible();
      await expect(
        inbox(contracting.page).getByRole("button", {
          exact: true,
          name: `Unread · ${unreadBefore + 2}`,
        })
      ).toBeVisible();
      const firstUpdate = inbox(contracting.page)
        .getByRole("button")
        .filter({ hasText: firstCode });
      await expect(firstUpdate).toHaveCount(1);
      await contracting.page.screenshot({ path: testInfo.outputPath("inbox-unread-desktop.png") });
      await contracting.page.getByRole("button", { name: "Open notifications" }).click();
      const bell = contracting.page.getByRole("dialog", { exact: true, name: "notifications" });
      await expect(bell.getByRole("button").filter({ hasText: firstCode })).toHaveCount(1);
      await expect(bell.getByRole("button").filter({ hasText: secondCode })).toHaveCount(1);
      await expect(bell).toHaveCSS("opacity", "1");
      await contracting.page.screenshot({ path: testInfo.outputPath("inbox-bell-desktop.png") });
      await contracting.page.keyboard.press("Escape");
      await expect(
        inbox(contracting.page).getByRole("button", {
          exact: true,
          name: `Unread · ${unreadBefore + 2}`,
        })
      ).toBeVisible();

      await openInbox(hr.page);
      await inbox(hr.page).getByRole("button", { exact: true, name: "All" }).click();
      await expect(inbox(hr.page).getByRole("button").filter({ hasText: firstCode })).toHaveCount(
        0
      );
      await expect(inbox(hr.page).getByRole("button").filter({ hasText: secondCode })).toHaveCount(
        0
      );
      await expect(hr.page.locator('a.portal-nav-link[href="/portal/contracting"]')).toHaveCount(0);

      await firstUpdate.click();
      await expect(contracting.page).toHaveURL(/\/portal\/queries\?open=query&id=/);
      await expect(entityModal(contracting.page)).toBeVisible();
      await expect(modalField(contracting.page, "Notes")).toHaveValue(
        "Synthetic local acceptance enquiry. Preserve these notes."
      );
      await contracting.page.screenshot({
        path: testInfo.outputPath("inbox-query-deep-link-desktop.png"),
      });
      await openInbox(contracting.page);
      await expect(
        inbox(contracting.page).getByRole("button", {
          exact: true,
          name: `Unread · ${unreadBefore + 1}`,
        })
      ).toBeVisible();
      await expect(
        inbox(contracting.page).getByRole("button").filter({ hasText: firstCode })
      ).toHaveCount(0);
      await expect(
        inbox(contracting.page).getByRole("button").filter({ hasText: secondCode })
      ).toHaveCount(1);
      await inbox(contracting.page).getByRole("button", { exact: true, name: "All" }).click();
      await expect(
        inbox(contracting.page).getByRole("button").filter({ hasText: firstCode })
      ).toContainText("Read");
      await expect(
        inbox(contracting.page).getByRole("button").filter({ hasText: secondCode })
      ).toContainText("Unread");
      await contracting.page.screenshot({ path: testInfo.outputPath("inbox-all-desktop.png") });

      await contracting.page.setViewportSize({ height: 844, width: 390 });
      await contracting.page.screenshot({ path: testInfo.outputPath("inbox-all-phone.png") });
      await contracting.page.getByRole("button", { name: "Open portal navigation" }).click();
      await expect(contracting.page.getByRole("dialog", { name: "Navigation" })).toHaveCSS(
        "opacity",
        "1"
      );
      await expect(contracting.page.getByRole("dialog", { name: "Navigation" })).toHaveCSS(
        "transform",
        /^(?:none|matrix\(1, 0, 0, 1, 0, 0\))$/
      );
      await expect(link.getByText("New activity", { exact: true })).toBeVisible();
      await contracting.page.screenshot({
        path: testInfo.outputPath("sidebar-count-activity-phone.png"),
      });
      await link.click();
      await expect(contracting.page).toHaveURL(/\/portal\/contracting$/);
      await contracting.page.getByRole("button", { name: "Open portal navigation" }).click();
      await expect(link.getByText("New activity", { exact: true })).toHaveCount(0);
      await expect(link.locator("[title$='work items need attention']")).toBeVisible();
      await takeTicketingWork(browser, firstCode, testInfo);
      expect(pageErrors).toEqual([]);
    } finally {
      await sales.context.close();
      await contracting.context.close();
      await hr.context.close();
    }
  });
});
