import { resolve } from "node:path";
import { cleanupE2eRun } from "../../e2e/helpers/seed";
import { loadE2eEnv } from "../../e2e/loadEnv";
import { formatCliHelp, parseCliArguments } from "../commands/cli";
import { validateE2ePreflight } from "./preflight";
import {
  readApprovedE2eTarget,
  verifyConvexE2eIdentity,
  verifyFrontendE2eIdentity,
} from "./target-identity";

const CLI = {
  command: "bun run test:e2e:cleanup --",
  description: "Resume bounded cleanup for one explicitly named non-production E2E run.",
  options: [{ name: "run-id", type: "string" }],
} as const;

if (import.meta.main) {
  try {
    const root = resolve(import.meta.dir, "../..");
    loadE2eEnv(root);
    const parsed = parseCliArguments(process.argv.slice(2), CLI);
    if (parsed.help) {
      console.log(formatCliHelp(CLI));
    } else {
      const runId = parsed.values["run-id"];
      if (typeof runId !== "string") {
        throw new Error("--run-id is required");
      }
      const baseUrl = process.env.BROWSER_SMOKE_BASE_URL ?? "http://localhost:3000";
      const preflight = validateE2ePreflight(process.env, baseUrl, true);
      const approvedTarget = readApprovedE2eTarget({
        baseUrl,
        convexSiteUrl: process.env.NEXT_PUBLIC_CONVEX_SITE_URL,
        manifestPath: process.env.E2E_TARGET_MANIFEST,
        target: preflight.target,
        targetId: process.env.E2E_TARGET_ID,
      });
      await verifyFrontendE2eIdentity(approvedTarget);
      await verifyConvexE2eIdentity(approvedTarget);
      const result = await cleanupE2eRun(runId, approvedTarget);
      console.log(
        JSON.stringify({
          complete: result.complete,
          deleted: result.deleted,
          residualCount: result.residualCount,
          runId: result.runId,
        })
      );
      if (!result.complete || result.residualCount !== 0) {
        process.exitCode = 1;
      }
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : "E2E cleanup failed");
    process.exitCode = 1;
  }
}
