import { expect, test } from "@playwright/test";
import { vercelProtectionBrowserHeaders } from "../../config/e2e/vercel-protection";
import { E2E_ROLE_PROFILE_KEYS } from "../fixtures/staffProfiles";
import { storageStatePath } from "../helpers/auth";
import { E2E_SKIP_REASON, hasE2eCredentials } from "../helpers/skip";

test.describe("@critical @smoke portal auth", () => {
  test.skip(!hasE2eCredentials(), E2E_SKIP_REASON);

  for (const role of E2E_ROLE_PROFILE_KEYS) {
    test(`${role} storage loads portal shell`, async ({ browser }) => {
      const context = await browser.newContext({
        extraHTTPHeaders: vercelProtectionBrowserHeaders(),
        storageState: storageStatePath(role),
      });
      const page = await context.newPage();
      await page.goto("/portal");
      await expect(page.getByRole("navigation").first()).toBeVisible({ timeout: 15_000 });
      await context.close();
    });
  }
});
