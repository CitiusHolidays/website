import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium, type FullConfig } from "@playwright/test";
import { validateE2ePreflight } from "../config/e2e/preflight";
import { readApprovedE2eTarget, verifyFrontendE2eIdentity } from "../config/e2e/target-identity";
import { vercelProtectionHeaders } from "../config/e2e/vercel-protection";
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

  await mkdir(AUTH_DIR, { recursive: true });

  const runId = randomUUID();
  let seed: Awaited<ReturnType<typeof seedE2eStaffProfiles>>;
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    seed = await seedE2eStaffProfiles(runId, approvedTarget.id);
    await mkdir(join(process.cwd(), ".scratch", "e2e"), { recursive: true });
    await writeFile(
      RUN_STATE_PATH,
      `${JSON.stringify({ runId: seed.run.runId, target: seed.run.target, targetId: seed.run.targetId }, null, 2)}\n`,
      { mode: 0o600 }
    );
    process.env.E2E_INCOMPLETE_PROPOSAL_CLIENT = seed.workflowFixtures.clientName;
    process.env.E2E_CEMENT_VISIBLE_CLIENT = seed.workflowFixtures.cementClientName;
    process.env.E2E_CEMENT_HIDDEN_CLIENT = seed.workflowFixtures.nonCementClientName;

    const { e2eStaffEmail } = await import("./fixtures/staffProfiles");
    browser = await chromium.launch();
    for (const role of E2E_ROLE_PROFILE_KEYS) {
      const email = e2eStaffEmail(role);
      const context = await browser.newContext({ extraHTTPHeaders: vercelProtectionHeaders() });
      const page = await context.newPage();

      await page.goto(`${baseURL}/auth/connect`);
      await page.getByLabel(/email/i).fill(email);
      await page.getByLabel(/^password$/i).fill(password ?? "");
      await page.getByRole("button", { name: /sign in/i }).click();
      await page.waitForURL(/\/portal/, { timeout: 30_000 });

      await context.storageState({ path: join(AUTH_DIR, `${role}.json`) });
      await context.close();
    }
  } catch (error) {
    await cleanupE2eRun(runId, approvedTarget.id).catch(() => undefined);
    throw error;
  } finally {
    await browser?.close();
  }
}

export default globalSetup;
