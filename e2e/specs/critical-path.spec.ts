import { expect, test } from "@playwright/test";
import { openPortalAs } from "../helpers/auth";
import { e2eChain, resetE2eChain, uniqueE2eLabel } from "../helpers/chainState";
import { expectConfirmDialog, holdToConfirmDelete } from "../helpers/confirm";
import { expectEntityModalOpen, modalCombobox, saveEntityModal } from "../helpers/modal";
import { selectOptionByMatchingLabel } from "../helpers/select";
import { E2E_SKIP_REASON, hasE2eCredentials } from "../helpers/skip";
import { ProposalsPage, QueriesPage, TravellersPage } from "../pages";

test.describe
  .serial("@critical CRM critical path", () => {
    test.skip(!hasE2eCredentials(), E2E_SKIP_REASON);

    test.beforeAll(() => {
      resetE2eChain();
      e2eChain.clientName = uniqueE2eLabel("E2E Client");
      e2eChain.travellerName = uniqueE2eLabel("E2E Traveller");
    });

    test("05 sales creates and submits query to contracting", async ({ browser }) => {
      const { context, page } = await openPortalAs(browser, "sales");
      const queries = new QueriesPage(page);
      await queries.open();
      await queries.createQuery(e2eChain.clientName);
      await expectEntityModalOpen(page);
      await saveEntityModal(page);

      const row = queries.queryRow(e2eChain.clientName);
      await expect(row).toBeVisible({ timeout: 15_000 });
      await expect(row.getByText(/submitted:/i)).toBeVisible();
      await expect(row.getByRole("button", { name: "Sales Decision" })).toBeVisible();
      await context.close();
    });

    test("06 contracting drafts proposal and sends to sales", async ({ browser }) => {
      const { context, page } = await openPortalAs(browser, "contracting");
      const proposals = new ProposalsPage(page);
      await proposals.open();
      await proposals.createProposalForQuery(e2eChain.clientName);
      await expectEntityModalOpen(page);
      await saveEntityModal(page);

      const row = proposals.proposalRow(e2eChain.clientName);
      await expect(row).toBeVisible({ timeout: 15_000 });
      await row.getByRole("button", { name: /send to sales/i }).click();
      await expect(page.getByText(/proposal sent to sales/i)).toBeVisible({ timeout: 15_000 });
      await context.close();
    });

    test("07 sales records order confirmed", async ({ browser }) => {
      const { context, page } = await openPortalAs(browser, "sales");
      const queries = new QueriesPage(page);
      await queries.open();
      const row = queries.queryRow(e2eChain.clientName);
      await row.getByRole("button", { name: "Sales Decision" }).click();
      await expectEntityModalOpen(page);
      await modalCombobox(page, "Sales Decision").selectOption({ label: "Order Confirmed" });
      await saveEntityModal(page);
      await expect(row.getByText(/confirmed:/i)).toBeVisible({ timeout: 15_000 });
      await expect(row.getByRole("status", { name: /confirmation stage/i })).toBeVisible();
      await context.close();
    });

    test("08 admin opens job card from confirmed query", async ({ browser }) => {
      const { context, page } = await openPortalAs(browser, "admin");
      await page.goto("/portal/accounts/job-cards");
      const row = page.locator("tr").filter({ hasText: e2eChain.clientName });
      await expect(row).toBeVisible({ timeout: 15_000 });
      await row.getByRole("button", { name: "Open JC" }).click();
      await expectEntityModalOpen(page);
      const proposalSelect = modalCombobox(page, "Linked Proposal");
      await proposalSelect.selectOption({ index: 1 });
      await expect(proposalSelect).not.toHaveValue("");
      await saveEntityModal(page);
      await expect(row.getByText(/linked to jc-/i)).toBeVisible({ timeout: 15_000 });
      const jobCodeText = await row.locator("text=/JC-/").first().textContent();
      e2eChain.jobCode = jobCodeText?.match(/JC-\d+-[A-Z]+/)?.[0] || "";
      expect(e2eChain.jobCode).toMatch(/JC-/);

      await page.goto("/portal/job-cards");
      const jobRow = page.locator("tr").filter({ hasText: e2eChain.jobCode });
      await expect(jobRow).toBeVisible({ timeout: 15_000 });
      await jobRow.getByRole("button", { name: `More actions for ${e2eChain.jobCode}` }).click();
      await page.getByRole("menuitem", { name: "Assign Ops" }).click();
      await expectEntityModalOpen(page);
      await selectOptionByMatchingLabel(modalCombobox(page, "Operations SPOC"), "E2E Operations");
      await saveEntityModal(page);
      await context.close();
    });

    test("09 operations creates and edits traveller", async ({ browser }) => {
      const { context, page } = await openPortalAs(browser, "operations");
      const travellers = new TravellersPage(page);
      await travellers.open();
      if (e2eChain.jobCode) {
        await travellers.filterByJobCard(e2eChain.jobCode);
      }
      await travellers.createTraveller(e2eChain.jobCode, e2eChain.travellerName);
      await expectEntityModalOpen(page);
      await saveEntityModal(page);

      const updatedName = `${e2eChain.travellerName} Edited`;
      const row = travellers.travellerRow(e2eChain.travellerName);
      await expect(row).toBeVisible({ timeout: 15_000 });
      await row.getByRole("button", { name: "Edit" }).click();
      await expectEntityModalOpen(page);
      await page.getByLabel("Full Name").fill(updatedName);
      await saveEntityModal(page);
      e2eChain.travellerName = updatedName;
      await expect(travellers.travellerRow(updatedName)).toBeVisible({ timeout: 15_000 });
      await context.close();
    });

    test("10 destructive delete requires hold-to-confirm", async ({ browser }) => {
      const { context, page } = await openPortalAs(browser, "operations");
      const travellers = new TravellersPage(page);
      await travellers.open();
      const row = travellers.travellerRow(e2eChain.travellerName);
      await expect(row).toBeVisible({ timeout: 15_000 });

      await row.getByRole("button", { name: /delete/i }).click();
      await expectConfirmDialog(page);

      await page.getByTestId("portal-confirm-hold").click();
      await expect(row).toBeVisible();

      await page.keyboard.press("Escape");
      await expect(page.getByTestId("portal-confirm-dialog")).toBeHidden();

      await row.getByRole("button", { name: /delete/i }).click();
      await expectConfirmDialog(page);
      await holdToConfirmDelete(page);
      await expect(page.getByText(e2eChain.travellerName)).toHaveCount(0, { timeout: 15_000 });
      await context.close();
    });
  });
