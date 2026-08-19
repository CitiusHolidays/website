import { expect, test } from "@playwright/test";
import { openPortalAs } from "../helpers/auth";
import { uniqueE2eLabel } from "../helpers/chainState";
import { expectConfirmDialog, holdToConfirmDelete } from "../helpers/confirm";
import { convexTravellerExists } from "../helpers/convexAssert";
import {
  expectEntityModalOpen,
  modalCombobox,
  modalField,
  saveEntityModal,
} from "../helpers/modal";
import { selectOptionByMatchingLabel } from "../helpers/select";
import { E2E_SKIP_REASON, hasE2eCredentials } from "../helpers/skip";
import { portalPages } from "../pages";

const { TravellersPage } = portalPages;

test.describe("@workflow Convex delete assertion", () => {
  test.skip(!hasE2eCredentials(), E2E_SKIP_REASON);
  test.skip(!process.env.E2E_SEED_SECRET, "Set E2E_SEED_SECRET for Convex backend assertions.");

  test("Traveller delete removes backend row", async ({ browser }) => {
    const travellerName = uniqueE2eLabel("E2E Convex Delete");
    const { context, page } = await openPortalAs(browser, "operations");
    const travellers = new TravellersPage(page);
    await travellers.open();

    await travellers.toolbarAction("Add Traveller").click();
    await expectEntityModalOpen(page);
    const jobCardField = modalCombobox(page, "Job Card");
    await selectOptionByMatchingLabel(jobCardField, "JC-E2E-WORKFLOW-EO");
    await modalField(page, "Full Name").fill(travellerName);
    await saveEntityModal(page);
    const row = travellers.travellerRow(travellerName);
    await expect(row).toBeVisible({ timeout: 15_000 });
    expect(convexTravellerExists({ fullName: travellerName })).toBe(true);

    await row.getByRole("button", { name: /delete/i }).click();
    await expectConfirmDialog(page);
    await holdToConfirmDelete(page);
    await expect(page.getByText(travellerName)).toHaveCount(0, { timeout: 15_000 });
    expect(convexTravellerExists({ fullName: travellerName })).toBe(false);
    await context.close();
  });
});
