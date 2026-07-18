import { expect, test } from "@playwright/test";
import { openPortalAs } from "../helpers/auth";
import { uniqueE2eLabel } from "../helpers/chainState";
import { expectEntityModalOpen, saveEntityModal } from "../helpers/modal";
import { E2E_SKIP_REASON, hasE2eCredentials } from "../helpers/skip";
import { TravellersPage } from "../pages";

test.describe("@smoke passport upload modal shell", () => {
  test.skip(!hasE2eCredentials(), E2E_SKIP_REASON);

  test("operations opens passport upload modal and cancels", async ({ browser }) => {
    const { context, page } = await openPortalAs(browser, "operations");
    const travellers = new TravellersPage(page);
    let travellerName = "";

    await page.goto("/portal/passport");
    const uploadRows = page.locator("tr").filter({
      has: page.getByRole("button", { name: /upload passport scan|upload scan/i }),
    });

    if ((await uploadRows.count()) === 0) {
      await travellers.open();
      const jobCode = await travellers.firstAvailableJobCardLabel();
      test.skip(!jobCode, "No Job Card options available for disposable traveller precondition.");

      travellerName = uniqueE2eLabel("E2E Passport Traveller");
      await travellers.createTraveller(jobCode!, travellerName);
      await expectEntityModalOpen(page);
      await saveEntityModal(page);
      await expect(travellers.travellerRow(travellerName)).toBeVisible({ timeout: 15_000 });
      await page.goto("/portal/passport");
    }

    const row = travellerName
      ? page.locator("tr").filter({ hasText: travellerName })
      : uploadRows.first();
    if (!travellerName) {
      travellerName = ((await row.locator("td").first().textContent()) || "").trim();
      expect(travellerName).not.toBe("");
    }

    await row.getByRole("button", { name: /upload passport scan|upload scan/i }).click();

    await expect(
      page.getByRole("heading", { name: `Upload & Encrypt Passport: ${travellerName}` })
    ).toBeVisible({ timeout: 5000 });
    await expect(page.locator("#passport-file-input")).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("heading", { name: /upload & encrypt passport/i })).toBeHidden();
    await context.close();
  });
});
