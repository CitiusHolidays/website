import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

export async function expectConfirmDialog(page: Page) {
  await expect(page.getByTestId("portal-confirm-dialog")).toBeVisible({ timeout: 5000 });
}

export async function holdToConfirmDelete(page: Page, holdMs = 2100) {
  const holdButton = page.getByTestId("portal-confirm-hold");
  await expect(holdButton).toBeVisible();
  await holdButton.hover();
  await page.mouse.down();
  await page.waitForTimeout(holdMs);
  await page.mouse.up();
  await expect(page.getByTestId("portal-confirm-dialog")).toBeHidden({ timeout: 15_000 });
}
