import { expect, test } from "@playwright/test";
import { openPortalAs } from "../../helpers/auth";
import { uniqueE2eLabel } from "../../helpers/chainState";
import { expectConfirmDialog, holdToConfirmDelete } from "../../helpers/confirm";
import { fillPortalDate, isoDate } from "../../helpers/date";
import {
  expectEntityModalOpen,
  modalCombobox,
  modalField,
  modalSpinbutton,
  saveEntityModal,
} from "../../helpers/modal";
import { selectOptionByMatchingLabel } from "../../helpers/select";
import { E2E_SKIP_REASON, hasE2eCredentials } from "../../helpers/skip";

test.describe("@workflow exact role semantics", () => {
  test.skip(!hasE2eCredentials(), E2E_SKIP_REASON);

  test("[queries-contracting-deny-sales-decision] contracting user does not see Sales Decision", async ({
    browser,
  }) => {
    const { context, page } = await openPortalAs(browser, "contracting");
    await page.goto("/portal/queries");
    await expect(
      page.getByRole("heading", { exact: true, level: 2, name: "All Sales Queries" })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Sales Decision" })).toHaveCount(0);
    await context.close();
  });

  test("[leave-head-then-hr] assigned head approves before HR final approval", async ({
    browser,
  }) => {
    const reason = uniqueE2eLabel("E2E two-stage leave");
    const { context: hrCreateContext, page: hrCreatePage } = await openPortalAs(browser, "hr");
    await hrCreatePage.goto("/portal/employees-on-leave");
    await hrCreatePage
      .getByTestId("portal-list-toolbar-actions")
      .getByRole("button", { name: /request leave|record leave/i })
      .first()
      .click();
    await expectEntityModalOpen(hrCreatePage);
    await selectOptionByMatchingLabel(modalCombobox(hrCreatePage, "Employee"), "E2E HR");
    await selectOptionByMatchingLabel(
      modalCombobox(hrCreatePage, "Leave Type"),
      "Leave Without Pay"
    );
    await fillPortalDate(modalField(hrCreatePage, "Start Date"), isoDate(21));
    await fillPortalDate(modalField(hrCreatePage, "End Date"), isoDate(22));
    await modalField(hrCreatePage, /reason for leave/i).fill(reason);
    await saveEntityModal(hrCreatePage);
    const hrPendingRow = hrCreatePage.locator("tr").filter({ hasText: reason });
    await expect(hrPendingRow).toBeVisible({ timeout: 15_000 });
    await expect(hrPendingRow.getByRole("button", { exact: true, name: "Approve" })).toHaveCount(0);
    await hrCreateContext.close();

    const { context: headContext, page: headPage } = await openPortalAs(browser, "leave-head");
    await headPage.goto("/portal/employees-on-leave");
    const headRow = headPage.locator("tr").filter({ hasText: reason });
    await expect(headRow).toBeVisible({ timeout: 15_000 });
    await headRow.getByRole("button", { exact: true, name: "Approve" }).click();
    await expect(headRow.getByText("Approved", { exact: true }).first()).toBeVisible();
    await expect(headRow.getByRole("button", { exact: true, name: "Approve" })).toHaveCount(0);
    await headContext.close();

    const { context: hrFinalContext, page: hrFinalPage } = await openPortalAs(browser, "hr");
    await hrFinalPage.goto("/portal/employees-on-leave");
    const hrFinalRow = hrFinalPage.locator("tr").filter({ hasText: reason });
    await expect(hrFinalRow.getByRole("button", { exact: true, name: "Approve" })).toBeVisible({
      timeout: 15_000,
    });
    await hrFinalRow.getByRole("button", { exact: true, name: "Approve" }).click();
    await expect(hrFinalRow.getByRole("button", { exact: true, name: "Approve" })).toHaveCount(0);
    await expect(hrFinalRow.getByText("Approved", { exact: true })).toHaveCount(3);
    await hrFinalRow.getByRole("button", { name: /Delete leave for E2E HR/i }).click();
    await expectConfirmDialog(hrFinalPage);
    await holdToConfirmDelete(hrFinalPage);
    await expect(hrFinalRow).toHaveCount(0);
    await hrFinalContext.close();
  });

  test("[cement-role-scope] Cement roles cannot enumerate non-Cement work", async ({ browser }) => {
    for (const role of ["sales-cement", "contracting-cement"] as const) {
      const { context, page } = await openPortalAs(browser, role);
      await page.goto("/portal/queries");
      await expect(page.locator("tbody tr").filter({ hasText: "E2E Cement Visible" })).toBeVisible({
        timeout: 15_000,
      });
      await expect(
        page.locator("tbody tr").filter({ hasText: "E2E Non Cement Hidden" })
      ).toHaveCount(0);
      await context.close();
    }
  });

  test("[proposal-incomplete-pricing-guard] Send to Sales refuses incomplete pricing", async ({
    browser,
  }) => {
    const { context, page } = await openPortalAs(browser, "contracting");
    await page.goto("/portal/proposals");
    const row = page.locator("tr").filter({ hasText: "E2E Incomplete Proposal Guard" });
    await expect(row).toBeVisible({ timeout: 15_000 });
    await row.getByRole("button", { name: "Send to Sales" }).click();
    await expect(page.getByRole("alert")).toHaveText(
      "Enter selling price and cost price on the proposal before sending it to Sales."
    );
    await expect(row.getByText("Draft", { exact: true })).toBeVisible();
    await row.getByRole("button", { name: "Edit" }).click();
    await expectEntityModalOpen(page);
    await modalSpinbutton(page, "Land Cost/Pax").fill("1000");
    await modalSpinbutton(page, "Selling Price per Person (pre-tax)").fill("2000");
    await saveEntityModal(page);
    await row.getByRole("button", { name: "Send to Sales" }).click();
    await expect(page.getByText(/Proposal sent to Sales/i)).toBeVisible({ timeout: 15_000 });
    await expect(row.getByText("With Sales", { exact: true })).toBeVisible();
    await context.close();
  });
});
