import { expect, test } from "@playwright/test";
import { openPortalAs } from "../helpers/auth";
import { uniqueE2eLabel } from "../helpers/chainState";
import { expectEntityModalOpen, saveEntityModal } from "../helpers/modal";
import { firstSelectableOptionLabel } from "../helpers/select";
import { E2E_SKIP_REASON, hasE2eCredentials } from "../helpers/skip";

test.describe("@smoke ticketing row edit", () => {
  test.skip(!hasE2eCredentials(), E2E_SKIP_REASON);

  test("ticketing opens edit modal and saves", async ({ browser }) => {
    const { context, page } = await openPortalAs(browser, "ticketing");
    await page.goto("/portal/tickets");
    const toolbar = page.getByTestId("portal-list-toolbar-actions");
    const issueTicketButton = toolbar.getByRole("button", { name: "Issue Ticket" });
    await expect(issueTicketButton).toBeVisible();

    await issueTicketButton.click();
    await expectEntityModalOpen(page);
    const jobCardSelect = page.getByLabel("Job Card");
    const firstJob = await firstSelectableOptionLabel(jobCardSelect);
    test.skip(!firstJob, "No Job Card options available for ticketing create precondition.");

    await jobCardSelect.selectOption({ label: firstJob! });
    const initialTicketNumber = uniqueE2eLabel("E2E-TKT-INITIAL");
    await page.getByLabel("Ticket Number").fill(initialTicketNumber);
    await saveEntityModal(page);

    const createdRow = page.locator("tr").filter({ hasText: initialTicketNumber });
    await expect(createdRow).toBeVisible({ timeout: 15_000 });
    const editButton = createdRow.getByRole("button", { name: "Edit" });
    await expect(editButton).toBeVisible({ timeout: 15_000 });
    await editButton.click();
    await expectEntityModalOpen(page);

    const ticketNumber = uniqueE2eLabel("E2E-TKT");
    await page.getByLabel("Ticket Number").fill(ticketNumber);
    await saveEntityModal(page);
    await expect(page.getByTestId("portal-entity-modal")).toBeHidden();

    const row = page.locator("tr").filter({ hasText: ticketNumber });
    await expect(row).toBeVisible({ timeout: 15_000 });
    await expect(row).toContainText(ticketNumber);
    await expect(page.locator("tr").filter({ hasText: initialTicketNumber })).toHaveCount(0);
    await context.close();
  });
});
