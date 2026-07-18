import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { chromium, type FullConfig } from "@playwright/test";
import { E2E_ROLE_PROFILE_KEYS } from "./fixtures/staffProfiles";
import { loadE2eEnv } from "./loadEnv";
import { seedE2eStaffProfiles } from "./helpers/seed";
import { e2eStrictMode } from "./helpers/skip";

loadE2eEnv();

const AUTH_DIR = join(process.cwd(), "e2e", ".auth");

async function globalSetup(config: FullConfig) {
  await mkdir(AUTH_DIR, { recursive: true });

  const password = process.env.E2E_STAFF_PASSWORD;
  const baseURL = config.projects[0]?.use?.baseURL ?? "http://localhost:3000";

  if (!password) {
    const message = "E2E_STAFF_PASSWORD is unset — skipping Playwright auth storageState generation.";
    if (e2eStrictMode()) {
      throw new Error(message);
    }
    console.warn(message);
    return;
  }

  seedE2eStaffProfiles();

  const { e2eStaffEmail } = await import("./fixtures/staffProfiles");
  const browser = await chromium.launch();

  for (const role of E2E_ROLE_PROFILE_KEYS) {
    const email = e2eStaffEmail(role);
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(`${baseURL}/auth/connect`);
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/^password$/i).fill(password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/\/portal/, { timeout: 30_000 });

    await context.storageState({ path: join(AUTH_DIR, `${role}.json`) });
    await context.close();
  }

  await browser.close();
}

export default globalSetup;
