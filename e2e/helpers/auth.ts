import { join } from "node:path";
import type { Browser } from "@playwright/test";
import { vercelProtectionBrowserHeaders } from "../../config/e2e/vercel-protection";
import type { E2eRoleProfileKey } from "../fixtures/staffProfiles";

export function storageStatePath(role: E2eRoleProfileKey) {
  return join(process.cwd(), "e2e", ".auth", `${role}.json`);
}

function customerStorageStatePath() {
  return join(process.cwd(), "e2e", ".auth", "customer.json");
}

export async function openPortalAs(browser: Browser, role: E2eRoleProfileKey) {
  const context = await browser.newContext({
    extraHTTPHeaders: vercelProtectionBrowserHeaders(),
    storageState: storageStatePath(role),
  });
  const page = await context.newPage();
  return { context, page };
}

export async function openCustomerAccount(browser: Browser) {
  const context = await browser.newContext({
    extraHTTPHeaders: vercelProtectionBrowserHeaders(),
    storageState: customerStorageStatePath(),
  });
  const page = await context.newPage();
  return { context, page };
}
