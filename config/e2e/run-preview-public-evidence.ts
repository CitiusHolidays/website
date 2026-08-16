import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { isRuntimeString, propertiesWhen } from "../../src/lib/runtimeValues";
import { formatCliHelp, parseCliArguments } from "../commands/cli";
import {
  createPreviewPublicSmokeEvidence,
  summarizeReleaseEvidence,
  writeReleaseEvidence,
} from "../release/release-evidence";
import { resolveWorkspaceRevision } from "../release/verify-local";
import { readApprovedE2eTarget, verifyFrontendE2eIdentity } from "./target-identity";

const CLI = {
  command: "bun run browser:evidence:preview-public --",
  description: "Run credential-free public browser evidence against an explicitly named Preview.",
  options: [
    { name: "base-url", type: "string" },
    { name: "target-id", type: "string" },
  ],
} as const;
const PREVIEW_TARGET_ID_PATTERN = /^preview-[A-Za-z0-9._:+-]+$/;

export function validatePreviewPublicTarget(baseUrl: string, targetId: string) {
  if (!PREVIEW_TARGET_ID_PATTERN.test(targetId)) {
    throw new Error("--target-id must be a redaction-safe identifier beginning with preview-");
  }
  const url = new URL(baseUrl);
  if (url.protocol !== "https:" || ["localhost", "127.0.0.1", "::1"].includes(url.hostname)) {
    throw new Error("Preview public evidence requires an explicit non-loopback HTTPS --base-url");
  }
  return url.toString();
}

if (import.meta.main) {
  try {
    const parsed = parseCliArguments(process.argv.slice(2), CLI);
    if (parsed.help) {
      console.log(formatCliHelp(CLI));
    } else {
      const baseUrl = parsed.values["base-url"];
      const targetId = parsed.values["target-id"];
      if (!(isRuntimeString(baseUrl) && isRuntimeString(targetId))) {
        throw new Error("--base-url and --target-id are required; Production is not supported");
      }
      const target = validatePreviewPublicTarget(baseUrl, targetId);
      const root = resolve(import.meta.dir, "../..");
      const approvedTarget = readApprovedE2eTarget({
        baseUrl: target,
        manifestPath: process.env.E2E_TARGET_MANIFEST,
        root,
        target: "preview",
        targetId,
      });
      await verifyFrontendE2eIdentity(approvedTarget);
      const revision = resolveWorkspaceRevision(root);
      const startedAt = new Date().toISOString();
      const result = spawnSync(
        "bunx",
        ["playwright", "test", "--config", "playwright.preview-public.config.ts"],
        {
          cwd: root,
          env: {
            ...process.env,
            BROWSER_SMOKE_BASE_URL: target,
            E2E_STAFF_PASSWORD: "",
            E2E_STRICT: "0",
          },
          stdio: "inherit",
        }
      );
      const finishedAt = new Date().toISOString();
      const passed = result.status === 0;
      const evidence = createPreviewPublicSmokeEvidence({
        artifactRefs: [".scratch/e2e-preview-public/results"],
        finishedAt,
        outcome: passed ? "passed" : "failed",
        ...propertiesWhen(!passed, () => ({ reason: "public browser spec failed" })),
        revision,
        startedAt,
        targetId,
      });
      const output = writeReleaseEvidence(root, "auto", evidence);
      console.log(summarizeReleaseEvidence(evidence));
      if (output) {
        console.log(`Wrote Preview public-smoke evidence to ${output}`);
      }
      if (!passed) {
        process.exitCode = 1;
      }
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Preview public evidence failed");
    process.exitCode = 1;
  }
}
