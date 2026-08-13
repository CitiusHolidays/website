import { readFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { validateE2ePreflight } from "../config/e2e/preflight";
import {
  readApprovedE2eTarget,
  verifyConvexE2eIdentity,
  verifyFrontendE2eIdentity,
} from "../config/e2e/target-identity";
import { cleanupE2eRun } from "./helpers/seed";
import { loadE2eEnv } from "./loadEnv";

loadE2eEnv();

const RUN_STATE_PATH = join(process.cwd(), ".scratch", "e2e", "active-run.json");

export default async function globalTeardown() {
  let runId = "";
  let targetId = "";
  try {
    const state = JSON.parse(await readFile(RUN_STATE_PATH, "utf8")) as {
      runId?: unknown;
      targetId?: unknown;
    };
    runId = typeof state.runId === "string" ? state.runId : "";
    targetId = typeof state.targetId === "string" ? state.targetId : "";
  } catch {
    return;
  }
  if (!(runId && targetId)) {
    throw new Error(
      "E2E run state is missing its run or target identity; cleanup cannot be proven."
    );
  }
  const baseUrl = process.env.BROWSER_SMOKE_BASE_URL ?? "http://localhost:3000";
  const preflight = validateE2ePreflight(process.env, baseUrl, true);
  const approvedTarget = readApprovedE2eTarget({
    baseUrl,
    convexSiteUrl: process.env.NEXT_PUBLIC_CONVEX_SITE_URL,
    manifestPath: process.env.E2E_TARGET_MANIFEST,
    target: preflight.target,
    targetId,
  });
  await verifyFrontendE2eIdentity(approvedTarget);
  await verifyConvexE2eIdentity(approvedTarget);
  const result = await cleanupE2eRun(runId, approvedTarget);
  if (!result.complete || result.residualCount !== 0) {
    throw new Error(
      `E2E cleanup for ${runId} is incomplete with ${result.residualCount} owned rows remaining.`
    );
  }
  await unlink(RUN_STATE_PATH);
}
