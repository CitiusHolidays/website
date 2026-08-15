import { expect, test } from "@playwright/test";
import { openPortalAs } from "../helpers/auth";
import { e2eChain, resetE2eChain, uniqueE2eLabel } from "../helpers/chainState";
import { expectConfirmDialog, holdToConfirmDelete } from "../helpers/confirm";
import { fillPortalDate } from "../helpers/date";
import {
  entityModal,
  expectEntityModalOpen,
  modalCombobox,
  modalField,
  modalSpinbutton,
  saveEntityModal,
} from "../helpers/modal";
import { selectFirstSelectableOption, selectOptionByMatchingLabel } from "../helpers/select";
import { E2E_SKIP_REASON, hasE2eCredentials } from "../helpers/skip";
import { ProposalsPage, QueriesPage, TravellersPage } from "../pages";

const PORTAL_QUERIES_URL_PATTERN = /\/portal\/queries(?:\?.*)?$/;
const PORTAL_DASHBOARD_URL_PATTERN = /\/portal\/?$/;

test.describe
  .serial("@critical CRM critical path", () => {
    test.skip(!hasE2eCredentials(), E2E_SKIP_REASON);

    test.beforeAll(() => {
      resetE2eChain();
      e2eChain.clientName = uniqueE2eLabel("E2E Client");
      e2eChain.travellerName = uniqueE2eLabel("E2E Traveller");
    });

    test("[crm-critical-05] sales creates and submits query to contracting", async ({
      browser,
    }) => {
      const { context, page } = await openPortalAs(browser, "sales");
      const queries = new QueriesPage(page);
      await queries.open();
      await queries.createQuery(e2eChain.clientName, "E2E Contracting", "Both");
      await expectEntityModalOpen(page);
      await modalField(page, "Destination").fill("Baku");
      await modalField(page, "Travel Date From").fill("2026-10-02");
      await modalField(page, "Travel Date To").fill("2026-10-08");
      await modalSpinbutton(page, "Budget per Person").fill("75000");
      await selectOptionByMatchingLabel(modalCombobox(page, "Travel in Series"), "Yes");
      await modalField(page, "Batch Details").fill("Two departures, one week apart");
      await entityModal(page)
        .getByLabel("Attachments")
        .setInputFiles({
          buffer: Buffer.from("sample itinerary"),
          mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          name: "sales-sample-itinerary.xlsx",
        });
      await saveEntityModal(page);

      const row = queries.queryRow(e2eChain.clientName);
      await expect(row).toBeVisible({ timeout: 15_000 });
      e2eChain.queryCode = (await row.getByText(/Q-\d+/).first().textContent())?.trim() || "";
      await expect(row.getByText(/submitted:/i)).toBeVisible();
      await expect(row.getByRole("button", { name: "Sales Decision" })).toBeVisible();
      await context.close();

      const { context: headContext, page: headPage } = await openPortalAs(
        browser,
        "ticketing-head"
      );
      await headPage.goto("/portal");
      await expect(
        headPage.getByText(new RegExp(`${e2eChain.queryCode}.*assign Ticketing SPOC`, "i"))
      ).toBeVisible({ timeout: 15_000 });
      await headContext.close();

      const { context: adminContext, page: adminPage } = await openPortalAs(browser, "admin");
      await adminPage.goto("/portal/queries");
      const adminRow = adminPage.locator("tr").filter({ hasText: e2eChain.clientName });
      await adminRow
        .getByRole("button", { name: `More actions for ${e2eChain.queryCode}` })
        .click();
      await adminPage.getByRole("menuitem", { name: /assign teams/i }).click();
      await expectEntityModalOpen(adminPage);
      await selectOptionByMatchingLabel(
        modalCombobox(adminPage, "Ticketing SPOC"),
        "E2E Ticketing"
      );
      await saveEntityModal(adminPage);
      await adminContext.close();

      const { context: assignedHeadContext, page: assignedHeadPage } = await openPortalAs(
        browser,
        "ticketing-head"
      );
      await assignedHeadPage.goto("/portal");
      await expect(
        assignedHeadPage.getByText(new RegExp(`${e2eChain.queryCode}.*assign Ticketing SPOC`, "i"))
      ).toHaveCount(0);
      await assignedHeadContext.close();
    });

    test("05b dashboard to All Sales Queries shows progressive navigation feedback", async ({
      browser,
    }, testInfo) => {
      const { context, page } = await openPortalAs(browser, "sales");
      await page.route("**/portal/queries**", async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 300));
        await route.continue();
      });
      await page.goto("/portal");
      await page.getByRole("button", { exact: true, name: "Enquiries" }).click();
      const queriesLink = page.getByRole("link", { exact: true, name: "All Sales Queries" });
      await expect(queriesLink).toBeVisible();

      await page.evaluate(() => performance.clearMarks());
      const navigation = queriesLink.click();
      await expect(page.getByTestId("portal-nav-link-pending")).toBeVisible({ timeout: 2000 });
      await navigation;
      await expect(page).toHaveURL(PORTAL_QUERIES_URL_PATTERN);
      await expect(
        page.getByRole("heading", { exact: true, level: 2, name: "All Sales Queries" })
      ).toBeVisible({ timeout: 15_000 });
      await expect(page.locator("tbody tr").first()).toBeVisible({ timeout: 15_000 });

      const marks = await page.evaluate(() =>
        performance.getEntriesByType("mark").map(({ name, startTime }) => ({ name, startTime }))
      );
      await testInfo.attach("portal-navigation-marks", {
        body: JSON.stringify(marks, null, 2),
        contentType: "application/json",
      });
      expect(marks.map(({ name }) => name)).toEqual(
        expect.arrayContaining([
          "citius-portal-navigation-start",
          "citius-portal-navigation-pending",
          "citius-portal-navigation-route-ready",
          "citius-portal-navigation-first-content",
        ])
      );

      await page.goBack();
      await expect(page).toHaveURL(PORTAL_DASHBOARD_URL_PATTERN);
      await expect(
        page.getByRole("link", { exact: true, name: "All Sales Queries" })
      ).toBeVisible();
      await page.goForward();
      await expect(page).toHaveURL(PORTAL_QUERIES_URL_PATTERN);
      await expect(
        page.getByRole("heading", { exact: true, level: 2, name: "All Sales Queries" })
      ).toBeVisible({ timeout: 15_000 });
      await page.goto("/portal/queries");
      await expect(page).toHaveURL(PORTAL_QUERIES_URL_PATTERN);
      await expect(
        page.getByRole("heading", { exact: true, level: 2, name: "All Sales Queries" })
      ).toBeVisible({ timeout: 15_000 });
      await context.close();
    });

    test("[crm-critical-06] contracting drafts proposal and sends to sales", async ({
      browser,
    }) => {
      const { context, page } = await openPortalAs(browser, "contracting");
      await page.goto("/portal/contracting");
      const queryRow = page.locator("tr").filter({ hasText: e2eChain.clientName });
      await expect(queryRow.getByText("sales-sample-itinerary.xlsx")).toBeVisible({
        timeout: 15_000,
      });
      await expect(queryRow.getByText("Travel in Series")).toHaveCount(0);
      await expect(queryRow.getByText("Yes")).toBeVisible();
      await expect(queryRow.getByText("Two departures, one week apart")).toBeVisible();
      await expect(queryRow.getByRole("button", { name: "Sales Decision" })).toHaveCount(0);

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

      const { context: ticketingContext, page: ticketingPage } = await openPortalAs(
        browser,
        "ticketing"
      );
      await ticketingPage.goto("/portal/queries");
      const ticketingRow = ticketingPage.locator("tr").filter({ hasText: e2eChain.clientName });
      await expect(ticketingRow.getByText("sales-sample-itinerary.xlsx")).toBeVisible({
        timeout: 15_000,
      });
      await ticketingContext.close();
    });

    test("[crm-critical-07] sales revises dates and records the Confirmed Offer", async ({
      browser,
    }) => {
      const { context, page } = await openPortalAs(browser, "sales");
      const queries = new QueriesPage(page);
      await queries.open();
      const row = queries.queryRow(e2eChain.clientName);
      await row.getByRole("button", { name: "Sales Decision" }).click();
      await expectEntityModalOpen(page);
      await selectOptionByMatchingLabel(
        modalCombobox(page, "Sales Decision"),
        "Date/Destination Change Required"
      );
      await modalField(page, /^Destination$/).fill("Tbilisi");
      await fillPortalDate(modalField(page, "Travel Start Date"), "2026-10-03");
      await fillPortalDate(modalField(page, "Travel End Date"), "2026-10-09");
      await saveEntityModal(page);
      await expect(row.getByText(/negotiation/i)).toBeVisible({ timeout: 15_000 });

      await row.getByRole("button", { name: "Sales Decision" }).click();
      await expectEntityModalOpen(page);
      await selectOptionByMatchingLabel(modalCombobox(page, "Sales Decision"), "Order Confirmed");
      await selectFirstSelectableOption(modalCombobox(page, "Accepted Proposal"));
      await modalSpinbutton(page, "Confirmed Pax").fill("2");
      await expect(modalSpinbutton(page, "Selling Price per Person")).toHaveValue("2500");
      await expect(modalSpinbutton(page, "Selling Price per Person")).toHaveAttribute(
        "readonly",
        ""
      );
      await fillPortalDate(modalField(page, "Travel Start Date"), "2026-10-03");
      await fillPortalDate(modalField(page, "Travel End Date"), "2026-10-09");
      await saveEntityModal(page);
      await expect(row.getByText(/confirmed:/i)).toBeVisible({ timeout: 15_000 });
      await expect(row.getByRole("status", { name: /confirmation stage/i })).toBeVisible();
      await expect(row.getByText("Awaiting Job Card")).toBeVisible();
      await context.close();
    });

    test("[crm-critical-08] admin opens job card from confirmed query", async ({ browser }) => {
      const { context, page } = await openPortalAs(browser, "admin");
      await page.goto("/portal/accounts/job-cards");
      const row = page.locator("tr").filter({ hasText: e2eChain.clientName });
      await expect(row).toBeVisible({ timeout: 15_000 });
      await row.getByRole("button", { name: "Open JC" }).click();
      await expectEntityModalOpen(page);
      const confirmedProposal = modalField(page, "Confirmed Proposal");
      await expect(confirmedProposal).toHaveValue(/^P-\d+\s+-\s+revision 1$/);
      await expect(confirmedProposal).toHaveAttribute("readonly", "");
      await expect(modalSpinbutton(page, "Selling Price per Person")).toHaveValue("2500");
      await expect(modalSpinbutton(page, "Selling Price per Person")).toHaveAttribute(
        "readonly",
        ""
      );
      await saveEntityModal(page);
      await expect(row.getByText(/linked to jc-/i)).toBeVisible({ timeout: 15_000 });
      const jobCodeText = await row.locator("text=/JC-/").first().textContent();
      e2eChain.jobCode = jobCodeText?.match(/JC-\d+-[A-Z]+/)?.[0] || "";
      expect(e2eChain.jobCode).toMatch(/JC-\d+-ES/);

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

    test("[crm-critical-09] operations creates and edits traveller", async ({ browser }) => {
      const { context, page } = await openPortalAs(browser, "operations");
      const travellers = new TravellersPage(page);
      await travellers.open();
      await travellers.filterByJobCard(e2eChain.jobCode);
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

    test("[crm-critical-10] destructive delete requires hold-to-confirm", async ({ browser }) => {
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
