import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

export async function expectConfirmDialog(page: Page) {
  await expect(page.getByTestId("portal-confirm-dialog")).toBeVisible({ timeout: 5000 });
}

export async function cancelConfirmDialog(page: Page) {
  await page.getByTestId("portal-confirm-cancel").click();
  await expect(page.getByTestId("portal-confirm-dialog")).toBeHidden();
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

export async function clickConfirmSubmit(page: Page) {
  await page.getByTestId("portal-confirm-submit").click();
  await expect(page.getByTestId("portal-confirm-dialog")).toBeHidden({ timeout: 15_000 });
}
