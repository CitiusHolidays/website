import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

export function entityModal(page: Page) {
  return page.getByTestId("portal-entity-modal");
}

/** Text/select fields inside the entity modal (avoids toolbar badges and duplicate labels). */
export function modalField(page: Page, label: string | RegExp) {
  return entityModal(page).getByLabel(label);
}

export function modalTextbox(page: Page, name: string | RegExp) {
  return entityModal(page).getByRole("textbox", { name });
}

export function modalSpinbutton(page: Page, name: string | RegExp) {
  return entityModal(page).getByRole("spinbutton", { name });
}

/** Native `<select>` inside the entity modal. */
export function modalCombobox(page: Page, name: string | RegExp) {
  return entityModal(page).getByRole("combobox", { name });
}

/** @deprecated Prefer `modalCombobox` — label text is split when fields are required. */
export function modalSelect(page: Page, label: string) {
  return modalCombobox(page, new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
}

export async function expectEntityModalOpen(page: Page) {
  await expect(entityModal(page)).toBeVisible({ timeout: 5000 });
}

export async function saveEntityModal(page: Page) {
  await page.getByTestId("portal-entity-modal-save").click();
  await expect(page.getByTestId("portal-entity-modal")).toBeHidden({ timeout: 15_000 });
}

export async function cancelEntityModal(page: Page) {
  await page.getByTestId("portal-entity-modal-cancel").click();
  await expect(page.getByTestId("portal-entity-modal")).toBeHidden({ timeout: 5000 });
}
