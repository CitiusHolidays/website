import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { type ApprovedE2eTarget, readApprovedE2eTarget } from "../e2e/target-identity";
import { computePerformanceSourceHash } from "./check-performance-budgets";
import { staffWorkspacePerformanceInputs } from "./performance-inputs";
import {
  parseStaffWorkspaceBackendCostBaseline,
  parseStaffWorkspaceBackendCostMetricsExport,
  type StaffWorkspaceBackendCostMetricsExport,
} from "./staff-workspace-backend-cost";

const INPUT_ROOT = ".scratch/performance";
const OUTPUT_PATH = `${INPUT_ROOT}/staff-workspace-backend-cost-candidate.json`;

function pathInside(root: string, requestedPath: string, label: string) {
  const boundary = resolve(root, INPUT_ROOT);
  const resolved = resolve(root, requestedPath);
  const within = relative(boundary, resolved);
  if (!within || within.startsWith("..")) {
    throw new Error(`${label} must name a file below ${INPUT_ROOT}`);
  }
  return resolved;
}

export function buildStaffWorkspaceBackendCostCandidate(args: {
  approvedTarget: ApprovedE2eTarget;
  currentRevision: string;
  metricsExport: StaffWorkspaceBackendCostMetricsExport;
  sourceFiles: string[];
  sourceHash: string;
}) {
  if (
    args.metricsExport.target.id !== args.approvedTarget.id ||
    args.metricsExport.target.kind !== args.approvedTarget.target
  ) {
    throw new Error("Backend-cost metrics target does not match the approved E2E target");
  }
  if (args.metricsExport.revision !== args.currentRevision) {
    throw new Error("Backend-cost metrics revision does not match the checked-out revision");
  }
  return parseStaffWorkspaceBackendCostBaseline({
    environment: `authenticated ${args.approvedTarget.target} backend metrics`,
    revision: args.currentRevision,
    samples: args.metricsExport.samples,
    schemaVersion: 2,
    sourceFiles: args.sourceFiles,
    sourceHash: args.sourceHash,
    status: "measured",
    target: {
      id: args.approvedTarget.id,
      kind: args.approvedTarget.target,
    },
  });
}

if (import.meta.main) {
  const root = resolve(import.meta.dir, "../..");
  const [, , requestedInput] = process.argv;
  if (!requestedInput) {
    throw new Error(
      "Usage: bun run performance:backend:ingest -- .scratch/performance/<safe-metrics-export>.json"
    );
  }
  const dirty = execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
  if (dirty) {
    throw new Error("Backend-cost evidence ingestion requires a clean tracked working tree");
  }
  const currentRevision = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
  const target = process.env.E2E_PROVISIONING_TARGET?.trim();
  if (!(target === "development" || target === "preview")) {
    throw new Error(
      "E2E_PROVISIONING_TARGET must be development or preview; Production is forbidden"
    );
  }
  const baseUrl = process.env.BROWSER_SMOKE_BASE_URL;
  const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
  if (!(baseUrl && convexSiteUrl)) {
    throw new Error("BROWSER_SMOKE_BASE_URL and NEXT_PUBLIC_CONVEX_SITE_URL are required");
  }
  const approvedTarget = readApprovedE2eTarget({
    baseUrl,
    convexSiteUrl,
    manifestPath: process.env.E2E_TARGET_MANIFEST,
    root,
    target,
    targetId: process.env.E2E_TARGET_ID,
  });
  const metricsExport = parseStaffWorkspaceBackendCostMetricsExport(
    JSON.parse(readFileSync(pathInside(root, requestedInput, "Metrics export"), "utf8")) as unknown
  );
  const sourceFiles = staffWorkspacePerformanceInputs(root);
  const sourceHash = computePerformanceSourceHash(root, sourceFiles);
  const candidate = buildStaffWorkspaceBackendCostCandidate({
    approvedTarget,
    currentRevision,
    metricsExport,
    sourceFiles,
    sourceHash,
  });

  const output = resolve(root, OUTPUT_PATH);
  mkdirSync(resolve(root, INPUT_ROOT), { recursive: true });
  writeFileSync(output, `${JSON.stringify(candidate, null, 2)}\n`, { flag: "w" });
  console.log(`Wrote privacy-safe candidate evidence to ${OUTPUT_PATH}`);
  console.log(
    "Review it before replacing the checked-in baseline; this command does not contact Convex."
  );
}
