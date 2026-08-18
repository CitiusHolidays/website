import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium, type FullConfig } from "@playwright/test";
import { validateE2ePreflight } from "../config/e2e/preflight";
import {
  readApprovedE2eTarget,
  verifyConvexE2eIdentity,
  verifyFrontendE2eIdentity,
} from "../config/e2e/target-identity";
import { vercelProtectionBrowserHeaders } from "../config/e2e/vercel-protection";
import { E2E_ROLE_PROFILE_KEYS } from "./fixtures/staffProfiles";
import { cleanupE2eRun, seedE2eStaffProfiles } from "./helpers/seed";
import { e2eStrictMode } from "./helpers/skip";
import { loadE2eEnv } from "./loadEnv";

loadE2eEnv();

const AUTH_DIR = join(process.cwd(), "e2e", ".auth");
const RUN_STATE_PATH = join(process.cwd(), ".scratch", "e2e", "active-run.json");

async function globalSetup(config: FullConfig) {
  const password = process.env.E2E_STAFF_PASSWORD;
  const baseURL = config.projects[0]?.use?.baseURL ?? "http://localhost:3000";
  const preflight = validateE2ePreflight(process.env, String(baseURL), e2eStrictMode());
  if (preflight.mode === "optional-skip") {
    const message =
      "Optional E2E discovery: authenticated setup was skipped because E2E_STAFF_PASSWORD is unset; this run is not authenticated proof.";
    console.warn(message);
    return;
  }
  const approvedTarget = readApprovedE2eTarget({
    baseUrl: String(baseURL),
    convexSiteUrl: process.env.NEXT_PUBLIC_CONVEX_SITE_URL,
    manifestPath: process.env.E2E_TARGET_MANIFEST,
    target: preflight.target,
    targetId: process.env.E2E_TARGET_ID,
  });
  await verifyFrontendE2eIdentity(approvedTarget);
  await verifyConvexE2eIdentity(approvedTarget);

  await mkdir(AUTH_DIR, { recursive: true });

  const runId = randomUUID();
  await mkdir(join(process.cwd(), ".scratch", "e2e"), { recursive: true });
  await writeFile(
    RUN_STATE_PATH,
    `${JSON.stringify({ runId, target: approvedTarget.target, targetId: approvedTarget.id }, null, 2)}\n`,
    { flag: "wx", mode: 0o600 }
  );
  let seed: Awaited<ReturnType<typeof seedE2eStaffProfiles>>;
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    seed = await seedE2eStaffProfiles(runId, approvedTarget);
    if (
      seed.run.runId !== runId ||
      seed.run.target !== approvedTarget.target ||
      seed.run.targetId !== approvedTarget.id
    ) {
      throw new Error("E2E seed returned a different run or target identity");
    }
    process.env.E2E_INCOMPLETE_PROPOSAL_CLIENT = seed.workflowFixtures.clientName;
    process.env.E2E_CEMENT_VISIBLE_CLIENT = seed.workflowFixtures.cementClientName;
    process.env.E2E_CEMENT_HIDDEN_CLIENT = seed.workflowFixtures.nonCementClientName;

    const { e2eStaffEmail } = await import("./fixtures/staffProfiles");
    browser = await chromium.launch();
    for (const role of E2E_ROLE_PROFILE_KEYS) {
      const email = e2eStaffEmail(role);
      const context = await browser.newContext({
        extraHTTPHeaders: vercelProtectionBrowserHeaders(),
      });
      const page = await context.newPage();

      await page.goto(`${baseURL}/auth/connect`);
      await page.getByLabel(/email/i).fill(email);
      await page.getByLabel(/^password$/i).fill(password ?? "");
      await page.getByRole("button", { name: /sign in/i }).click();
      await page.waitForURL(/\/portal/, { timeout: 30_000 });

      await context.storageState({ path: join(AUTH_DIR, `${role}.json`) });
      await context.close();
    }

    const customerContext = await browser.newContext({
      extraHTTPHeaders: vercelProtectionBrowserHeaders(),
    });
    const customerPage = await customerContext.newPage();
    await customerPage.goto(`${baseURL}/auth/guest`);
    await customerPage.getByLabel(/email/i).fill(seed.customerFixture.email);
    await customerPage.getByLabel(/^password$/i).fill(password ?? "");
    await customerPage.getByRole("button", { name: /^sign in$/i }).click();
    await customerPage.waitForURL(/\/account/, { timeout: 30_000 });
    await customerContext.storageState({ path: join(AUTH_DIR, "customer.json") });
    await customerContext.close();
  } catch (error) {
    const cleanup = await cleanupE2eRun(runId, approvedTarget).catch(() => undefined);
    if (cleanup?.complete && cleanup.residualCount === 0) {
      await unlink(RUN_STATE_PATH).catch(() => undefined);
    }
    throw error;
  } finally {
    await browser?.close();
  }
}

export default globalSetup;
