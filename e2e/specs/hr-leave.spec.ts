import { expect, test } from "@playwright/test";
import { openPortalAs } from "../helpers/auth";
import { uniqueE2eLabel } from "../helpers/chainState";
import { isoDate, fillPortalDate } from "../helpers/date";
import { expectEntityModalOpen, modalCombobox, modalField, saveEntityModal } from "../helpers/modal";
import { selectOptionByMatchingLabel } from "../helpers/select";
import { E2E_SKIP_REASON, hasE2eCredentials } from "../helpers/skip";

test.describe("@smoke HR leave submit", () => {
  test.skip(!hasE2eCredentials(), E2E_SKIP_REASON);

  test("hr submits leave request", async ({ browser }) => {
    const reason = uniqueE2eLabel("E2E leave request");
    const { context, page } = await openPortalAs(browser, "hr");
    await page.goto("/portal/employees-on-leave");
    const toolbar = page.getByTestId("portal-list-toolbar-actions");
    const requestButton = toolbar
      .getByRole("button", { name: /request leave|record leave/i })
      .first();
    await requestButton.click();
    await expectEntityModalOpen(page);

    await selectOptionByMatchingLabel(modalCombobox(page, "Employee"), "E2E HR");
    await fillPortalDate(modalField(page, "Start Date"), isoDate(7));
    await fillPortalDate(modalField(page, "End Date"), isoDate(9));
    await modalField(page, /reason for leave/i).fill(reason);
    await saveEntityModal(page);

    const row = page.locator("tr").filter({ hasText: reason });
    await expect(row).toBeVisible({ timeout: 15_000 });
    await expect(row.getByRole("status", { name: /leave approval required/i })).toBeVisible();
    await context.close();
  });
});
