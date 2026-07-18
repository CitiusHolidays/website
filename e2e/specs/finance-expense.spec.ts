import { expect, test } from "@playwright/test";
import { openPortalAs } from "../helpers/auth";
import { uniqueE2eLabel } from "../helpers/chainState";
import { fillPortalDate, isoDate } from "../helpers/date";
import { expectEntityModalOpen, modalField, saveEntityModal } from "../helpers/modal";
import { E2E_SKIP_REASON, hasE2eCredentials } from "../helpers/skip";

test.describe("@smoke finance expense flow", () => {
  test.skip(!hasE2eCredentials(), E2E_SKIP_REASON);

  test("finance creates and submits expense", async ({ browser }) => {
    const paidBy = uniqueE2eLabel("E2E Finance Paid By");
    const { context, page } = await openPortalAs(browser, "finance");
    await page.goto("/portal/expenses");
    await page
      .getByTestId("portal-list-toolbar-actions")
      .getByRole("button", { name: "Add Expense" })
      .click();
    await expectEntityModalOpen(page);

    await modalField(page, "Expense Type").selectOption({ label: "Office / General" });
    await fillPortalDate(modalField(page, "Expense Date"), isoDate());
    await modalField(page, "Category").selectOption({ label: "F&B" });
    await modalField(page, "Paid By").fill(paidBy);
    await modalField(page, "Card Amount").fill("100");
    await saveEntityModal(page);

    const row = page.locator("tr").filter({ hasText: paidBy });
    await expect(row).toBeVisible({ timeout: 15_000 });
    const submitButton = row.getByRole("button", { name: /submit for approval/i });
    await expect(submitButton).toBeVisible();
    await submitButton.click();
    await expect(row.getByRole("status", { name: /pending/i }).first()).toBeVisible({
      timeout: 15_000,
    });
    await context.close();
  });
});
