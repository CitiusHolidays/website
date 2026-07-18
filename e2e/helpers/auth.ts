import { join } from "node:path";
import type { Browser } from "@playwright/test";
import type { E2eRoleProfileKey } from "../fixtures/staffProfiles";

export function storageStatePath(role: E2eRoleProfileKey) {
  return join(process.cwd(), "e2e", ".auth", `${role}.json`);
}

export async function openPortalAs(browser: Browser, role: E2eRoleProfileKey) {
  const context = await browser.newContext({ storageState: storageStatePath(role) });
  const page = await context.newPage();
  return { context, page };
}
