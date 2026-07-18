import { expect, test } from "@playwright/test";
import { openPortalAs } from "../helpers/auth";
import { cancelEntityModal, expectEntityModalOpen, modalTextbox } from "../helpers/modal";
import { hasE2eCredentials, E2E_SKIP_REASON } from "../helpers/skip";
import { uniqueE2eLabel } from "../helpers/chainState";

test.describe("@smoke admin settings staff modal", () => {
  test.skip(!hasE2eCredentials(), E2E_SKIP_REASON);

  test("admin opens staff modal and cancels", async ({ browser }) => {
    const { context, page } = await openPortalAs(browser, "admin");
    await page.goto("/portal/settings");
    await page.getByTestId("portal-list-toolbar-actions").getByRole("button", { name: "Add Staff" }).click();
    await expectEntityModalOpen(page);
    await modalTextbox(page, /^Name/).fill(uniqueE2eLabel("E2E Staff"));
    await modalTextbox(page, /^Email/).fill(`e2e-staff-${Date.now()}@citius-e2e.test`);
    await cancelEntityModal(page);
    await expect(page.getByTestId("portal-entity-modal")).toBeHidden();
    await context.close();
  });
});
