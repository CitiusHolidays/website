import { execFileSync } from "node:child_process";
import type { ApprovedE2eTarget } from "./target-identity";
import { verifyConvexE2eIdentity, verifyFrontendE2eIdentity } from "./target-identity";

const SAFE_RUN_ID_PATTERN = /^[0-9a-f-]{36}$/i;

export interface E2eTargetCleanupAudit {
  activeActors: number;
  auditedAt: string;
  boundExceeded: false;
  exportSourceChunks: number;
  importOperationBatches: number;
  incompleteRuns: number;
  latestRun: {
    mutatedRecords: number;
    ownedRecords: number;
    runId: string;
    status: "complete";
  };
  mutatedRecords: number;
  ownedRecords: number;
  passengerExportOperations: number;
  passengerImportOperations: number;
  runsAudited: number;
  storageReferences: number;
  syntheticTravellers: number;
  targetId: string;
}

const COUNT_FIELDS = [
  "activeActors",
  "exportSourceChunks",
  "importOperationBatches",
  "incompleteRuns",
  "mutatedRecords",
  "ownedRecords",
  "passengerExportOperations",
  "passengerImportOperations",
  "runsAudited",
  "storageReferences",
  "syntheticTravellers",
] as const;

function assertRecord(value: unknown, path: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${path} must be an object`);
  }
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[], path: string) {
  const expected = new Set(keys);
  if (Object.keys(value).some((key) => !expected.has(key))) {
    throw new Error(`${path} contains an undeclared field`);
  }
}

function nonnegativeInteger(value: unknown, path: string) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error(`${path} must be a nonnegative integer`);
  }
  return value;
}

export function parseZeroE2eTargetCleanupAudit(
  value: unknown,
  expectedTargetId?: string
): E2eTargetCleanupAudit {
  assertRecord(value, "cleanup audit");
  exactKeys(
    value,
    [...COUNT_FIELDS, "auditedAt", "boundExceeded", "latestRun", "targetId"],
    "cleanup audit"
  );
  const counts = Object.fromEntries(
    COUNT_FIELDS.map((field) => [field, nonnegativeInteger(value[field], `cleanup audit.${field}`)])
  ) as Record<(typeof COUNT_FIELDS)[number], number>;
  if (counts.runsAudited < 1) {
    throw new Error("cleanup audit.runsAudited must prove at least one target run");
  }
  for (const field of COUNT_FIELDS) {
    if (field !== "runsAudited" && counts[field] !== 0) {
      throw new Error(`cleanup audit.${field} must be zero`);
    }
  }
  if (value.boundExceeded !== false) {
    throw new Error("cleanup audit must complete without reaching a scan bound");
  }
  if (typeof value.targetId !== "string" || value.targetId !== expectedTargetId) {
    throw new Error("cleanup audit.targetId must match the approved target");
  }
  if (
    typeof value.auditedAt !== "string" ||
    new Date(value.auditedAt).toISOString() !== value.auditedAt
  ) {
    throw new Error("cleanup audit.auditedAt must be a canonical ISO timestamp");
  }
  assertRecord(value.latestRun, "cleanup audit.latestRun");
  exactKeys(
    value.latestRun,
    ["mutatedRecords", "ownedRecords", "runId", "status"],
    "cleanup audit.latestRun"
  );
  if (
    value.latestRun.status !== "complete" ||
    value.latestRun.mutatedRecords !== 0 ||
    value.latestRun.ownedRecords !== 0 ||
    typeof value.latestRun.runId !== "string" ||
    !SAFE_RUN_ID_PATTERN.test(value.latestRun.runId)
  ) {
    throw new Error("cleanup audit.latestRun must be a complete zero-residual UUID run");
  }
  return {
    ...counts,
    auditedAt: value.auditedAt,
    boundExceeded: false,
    latestRun: {
      mutatedRecords: 0,
      ownedRecords: 0,
      runId: value.latestRun.runId,
      status: "complete",
    },
    targetId: value.targetId,
  };
}

function deploymentSelector(approvedTarget: ApprovedE2eTarget) {
  if (approvedTarget.target === "development") {
    return "local";
  }
  const [deployment] = new URL(approvedTarget.convexSiteOrigin).hostname.split(".");
  if (!(deployment && approvedTarget.id.startsWith(`preview-${deployment}`))) {
    throw new Error("Approved Preview target does not bind a Convex deployment selector");
  }
  return deployment;
}

export async function collectZeroE2eTargetCleanupAudit(
  approvedTarget: ApprovedE2eTarget,
  root = process.cwd()
) {
  await verifyFrontendE2eIdentity(approvedTarget);
  await verifyConvexE2eIdentity(approvedTarget);
  const output = execFileSync(
    "bunx",
    [
      "convex",
      "run",
      "crm/e2eRunOwnership:auditTarget",
      JSON.stringify({ targetId: approvedTarget.id }),
      "--deployment",
      deploymentSelector(approvedTarget),
    ],
    { cwd: root, encoding: "utf8", env: process.env, maxBuffer: 5 * 1024 * 1024 }
  );
  const providerAudit = JSON.parse(output) as unknown;
  return parseZeroE2eTargetCleanupAudit(
    {
      ...(providerAudit as Record<string, unknown>),
      auditedAt: new Date().toISOString(),
    },
    approvedTarget.id
  );
}
