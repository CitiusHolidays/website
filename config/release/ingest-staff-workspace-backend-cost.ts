import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { type ApprovedE2eTarget, readApprovedE2eTarget } from "../e2e/target-identity";
import { computePerformanceSourceHash } from "./check-performance-budgets";
import { type P95RelativeComparison, planPerformanceComparisons } from "./performance-comparison";
import { staffWorkspacePerformanceInputs } from "./performance-inputs";
import {
  evaluateStaffWorkspaceBackendCost,
  evaluateStaffWorkspaceBackendCostRelativeRegression,
  parseStaffWorkspaceBackendCostBaseline,
  parseStaffWorkspaceBackendCostBudgetManifest,
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
  comparison: {
    acceptedBaselineDigest: string;
    acceptedRevision: string;
    acceptedSourceHash: string;
    fixedFindingCount: 0;
    p95RelativeComparison: P95RelativeComparison;
    relativeFindingCount: 0;
  };
  currentRevision: string;
  metricsExport: StaffWorkspaceBackendCostMetricsExport;
  sourceFiles: string[];
  sourceHash: string;
}) {
  if (
    args.metricsExport.schemaVersion !== 3 ||
    JSON.stringify(args.metricsExport.targetBinding) !== JSON.stringify(args.approvedTarget)
  ) {
    throw new Error("Backend-cost metrics target does not match the approved E2E target");
  }
  if (args.metricsExport.revision !== args.currentRevision) {
    throw new Error("Backend-cost metrics revision does not match the checked-out revision");
  }
  return parseStaffWorkspaceBackendCostBaseline({
    capturedAt: args.metricsExport.capturedAt,
    comparison: args.comparison,
    environment: `authenticated ${args.approvedTarget.target} backend metrics`,
    p95Samples: args.metricsExport.p95Samples,
    provider: args.metricsExport.provider,
    revision: args.currentRevision,
    samples: args.metricsExport.samples,
    schemaVersion: 3,
    sourceFiles: args.sourceFiles,
    sourceHash: args.sourceHash,
    status: "measured",
    target: {
      id: args.approvedTarget.id,
      kind: args.approvedTarget.target,
    },
    targetBinding: args.metricsExport.targetBinding,
    trialCount: args.metricsExport.trialCount,
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
  const acceptedPath = resolve(root, "config/release/staff-workspace-backend-cost-baseline.json");
  const acceptedRaw = readFileSync(acceptedPath, "utf8");
  const accepted = parseStaffWorkspaceBackendCostBaseline(JSON.parse(acceptedRaw));
  if (accepted.status !== "measured") {
    throw new Error("Backend-cost ingestion requires an accepted measured baseline for comparison");
  }
  const budget = parseStaffWorkspaceBackendCostBudgetManifest(
    JSON.parse(
      readFileSync(
        resolve(root, "config/release/staff-workspace-backend-cost-budgets.json"),
        "utf8"
      )
    )
  );
  const candidateSamples = [...metricsExport.samples, ...(metricsExport.p95Samples ?? [])];
  const fixedFindings = candidateSamples.flatMap((sample) =>
    evaluateStaffWorkspaceBackendCost(budget, sample)
  );
  const comparisonPlan = planPerformanceComparisons({
    acceptedMedian: accepted.samples,
    candidateMedian: metricsExport.samples,
    candidateP95: metricsExport.p95Samples ?? [],
    key: (sample) => `${sample.target}:${sample.warm}`,
  });
  const relativeFindings = comparisonPlan.pairs.flatMap(
    ({ accepted: acceptedSample, candidate: candidateSample }) =>
      evaluateStaffWorkspaceBackendCostRelativeRegression(budget, candidateSample, acceptedSample)
  );
  if (fixedFindings.length > 0 || relativeFindings.length > 0) {
    throw new Error(
      `Backend-cost candidate failed ${fixedFindings.length} fixed and ${relativeFindings.length} relative budgets`
    );
  }
  const candidate = buildStaffWorkspaceBackendCostCandidate({
    approvedTarget,
    comparison: {
      acceptedBaselineDigest: createHash("sha256").update(acceptedRaw).digest("hex"),
      acceptedRevision: accepted.revision!,
      acceptedSourceHash: accepted.sourceHash!,
      fixedFindingCount: 0,
      p95RelativeComparison: comparisonPlan.p95RelativeComparison,
      relativeFindingCount: 0,
    },
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
