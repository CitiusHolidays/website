import { expect, test } from "@playwright/test";
import { openPortalAs } from "../helpers/auth";
import { uniqueE2eLabel } from "../helpers/chainState";
import { expectEntityModalOpen, modalCombobox, saveEntityModal } from "../helpers/modal";
import { E2E_SKIP_REASON, hasE2eCredentials } from "../helpers/skip";
import { ProposalsPage, QueriesPage } from "../pages";

test.describe("@critical sales decision under discussion", () => {
  test.skip(!hasE2eCredentials(), E2E_SKIP_REASON);

  test("sales records proposal under discussion", async ({ browser }) => {
    const clientName = uniqueE2eLabel("E2E Discussion");
    const { context: salesContext, page: salesPage } = await openPortalAs(browser, "sales");
    const queries = new QueriesPage(salesPage);
    await queries.open();
    await queries.createQuery(clientName);
    await expectEntityModalOpen(salesPage);
    await saveEntityModal(salesPage);
    const queryRow = queries.queryRow(clientName);
    await expect(queryRow).toBeVisible({ timeout: 15_000 });
    await expect(queryRow.getByText(/submitted:/i)).toBeVisible();
    await salesContext.close();

    const { context: contractingContext, page: contractingPage } = await openPortalAs(
      browser,
      "contracting"
    );
    const proposals = new ProposalsPage(contractingPage);
    await proposals.open();
    await proposals.createProposalForQuery(clientName);
    await expectEntityModalOpen(contractingPage);
    await saveEntityModal(contractingPage);
    await proposals
      .proposalRow(clientName)
      .getByRole("button", { name: /send to sales/i })
      .click();
    await contractingContext.close();

    const { context, page } = await openPortalAs(browser, "sales");
    await page.goto("/portal/queries");
    await page
      .locator("tr")
      .filter({ hasText: clientName })
      .getByRole("button", { name: "Sales Decision" })
      .click();
    await expectEntityModalOpen(page);
    await modalCombobox(page, "Sales Decision").selectOption({
      label: "Proposal Under Discussion",
    });
    await saveEntityModal(page);
    await expect(page.getByText(/discussion/i).first()).toBeVisible({ timeout: 15_000 });
    await context.close();
  });
});
