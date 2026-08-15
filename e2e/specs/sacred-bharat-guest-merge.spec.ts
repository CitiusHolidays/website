import { expect, test } from "@playwright/test";
import { openCustomerAccount } from "../helpers/auth";
import { E2E_SKIP_REASON, hasE2eCredentials } from "../helpers/skip";

const GUEST_DRAFT_KEY = "citius-sacred-bharat-draft";

test.describe("@critical Sacred Bharat guest progress", () => {
  test.skip(!hasE2eCredentials(), E2E_SKIP_REASON);

  test("merges one guest draft into the authenticated account and clears the local copy", async ({
    browser,
  }) => {
    const { context, page } = await openCustomerAccount(browser);
    await context.addInitScript(
      ({ key }) => {
        if (!window.localStorage.getItem(key)) {
          window.localStorage.setItem(
            key,
            JSON.stringify({
              templeIds: ["kedarnath"],
              wishlist: [{ itemId: "shiva-trail", itemType: "trail" }],
            })
          );
        }
      },
      { key: GUEST_DRAFT_KEY }
    );
    await page.goto("/sacred-bharat");

    await expect(page.getByText("Your local pilgrimage is saved to your account.")).toBeVisible({
      timeout: 30_000,
    });
    await expect
      .poll(() => page.evaluate((key) => window.localStorage.getItem(key), GUEST_DRAFT_KEY))
      .toBeNull();
    const sacredSites = page
      .locator("div")
      .filter({ hasText: /^\d+\/\d+Sacred sites$/ })
      .first();
    await expect(sacredSites).toContainText(/^1\/\d+Sacred sites$/);
    await context.close();
  });
});
