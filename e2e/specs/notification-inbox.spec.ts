import { expect, type Page, test } from "@playwright/test";
import { openPortalAs } from "../helpers/auth";
import { uniqueE2eLabel } from "../helpers/chainState";
import { entityModal, modalField, saveEntityModal } from "../helpers/modal";
import { E2E_SKIP_REASON, hasE2eCredentials } from "../helpers/skip";
import { QueriesPage } from "../pages/queriesPage";

function inbox(page: Page) {
  return page.getByRole("region", { name: "Your notifications" });
}

function contractingLink(page: Page) {
  return page.locator('a.portal-nav-link[href="/portal/contracting"]').filter({ visible: true });
}

async function createQuery(page: Page, clientName: string) {
  const queries = new QueriesPage(page);
  await queries.open();
  await queries.createQuery(clientName);
  await modalField(page, "Destination").fill("Jaipur");
  await modalField(page, "Notes").fill("Synthetic local acceptance enquiry. Preserve these notes.");
  await saveEntityModal(page);
  const row = queries.queryRow(clientName);
  await expect(row).toBeVisible();
  const code = await row.getByText(/Q-\d+/).first().textContent();
  expect(code).toMatch(/Q-\d+/);
  return code?.trim() ?? "";
}

async function openInbox(page: Page) {
  await page.goto("/portal/activity");
  await expect(inbox(page).getByRole("button", { name: /^Unread(?: · \d+)?$/ })).toBeVisible();
  await expect(inbox(page).getByRole("status", { name: "Loading notifications" })).toBeHidden();
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

      const firstCode = await createQuery(sales.page, uniqueE2eLabel("E2E Cedar Conference"));
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
      await expect(link.getByText("New activity", { exact: true })).toBeVisible();
      await contracting.page.screenshot({
        path: testInfo.outputPath("sidebar-count-activity-phone.png"),
      });
      await link.click();
      await expect(contracting.page).toHaveURL(/\/portal\/contracting$/);
      await contracting.page.getByRole("button", { name: "Open portal navigation" }).click();
      await expect(link.getByText("New activity", { exact: true })).toHaveCount(0);
      await expect(link.locator("[title$='work items need attention']")).toBeVisible();
      expect(pageErrors).toEqual([]);
    } finally {
      await sales.context.close();
      await contracting.context.close();
      await hr.context.close();
    }
  });
});
