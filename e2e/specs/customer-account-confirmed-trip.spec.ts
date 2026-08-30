import { expect, test } from "@playwright/test";
import { openCustomerAccount } from "../helpers/auth";
import { E2E_SKIP_REASON, hasE2eCredentials } from "../helpers/skip";

test.describe("@critical Customer Account entitlement", () => {
  test.skip(!hasE2eCredentials(), E2E_SKIP_REASON);

  test("Shows the explicit read-only confirmed trip without Staff or payment data", async ({
    browser,
  }) => {
    const { context, page } = await openCustomerAccount(browser);
    await page.goto("/account");

    await expect(
      page.getByRole("heading", { exact: true, level: 2, name: "Arrival Packs" })
    ).toBeVisible({ timeout: 30_000 });
    const packet = page.locator("article").filter({ hasText: "E2E Customer Journey" });
    await expect(packet).toBeVisible();
    await expect(packet.getByRole("heading", { name: "E2E Customer Journey" })).toBeVisible();
    await expect(packet.getByText("Organizer access")).toBeVisible();
    await expect(packet.getByRole("heading", { name: "Journey readiness" })).toBeVisible();
    await expect(packet.getByText("Pending — Unknown").first()).toBeVisible();
    await expect(
      packet.getByRole("link", { name: "Download offline Arrival Pack" })
    ).toHaveAttribute("download", "");
    await expect(
      packet.getByText(
        /travellers|job card|selling price|tax rate|created by|payment id|passport|visa/i
      )
    ).toHaveCount(0);

    await page.getByRole("button", { exact: true, name: "Profile" }).click();
    await expect(page.getByText("e2e-customer@citius-e2e.test", { exact: true })).toBeVisible();
    await context.close();
  });
});
