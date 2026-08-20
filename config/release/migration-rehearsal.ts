import { readFileSync } from "node:fs";
import {
  isRuntimeBoolean,
  isRuntimeNumber,
  isRuntimeObject,
  isRuntimeString,
} from "../../src/lib/runtimeValues";
import { formatCliHelp, parseCliArguments } from "../commands/cli";
import type { JsonObject, JsonValue } from "../lib/jsonValue";

const APPROVAL_STATES = ["draft", "rehearsal-approved", "production-approved"] as const;
const APPROVAL_VALUES = ["pending", "approved", "completed"] as const;
const DEPLOYMENT_CLASSES = ["development", "production"] as const;
const EVIDENCE_OUTCOMES = ["pending", "passed", "failed", "blocked"] as const;
const GIT_SHA_PATTERN = /^[a-f0-9]{40}$/;
const SAFE_FUNCTION_PATTERN = /^[A-Za-z0-9_/]+:[A-Za-z0-9_]+$/;
const SAFE_IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;
const SAFE_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{2,79}$/;
const SENSITIVE_KEY_PATTERN = /(secret|password|token|cookie|authorization|snapshotContents|rows)/i;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

const MIGRATION_REHEARSAL_CLI = {
  command: "bun run migration:rehearsal --",
  description:
    "Validate and print a planning-only migration rehearsal. This command never contacts or mutates a deployment.",
  options: [
    {
      description: "Path to a schema-versioned rehearsal manifest",
      name: "manifest",
      type: "string",
    },
    { description: "Emit the plan as JSON", name: "json", type: "boolean" },
  ],
} as const;

type ApprovalState = (typeof APPROVAL_STATES)[number];
type ApprovalValue = (typeof APPROVAL_VALUES)[number];
type SourceDeploymentClass = (typeof DEPLOYMENT_CLASSES)[number];

export interface MigrationRehearsalManifest {
  approval: {
    rehearsalImport: ApprovalValue;
    productionPromotion: ApprovalValue;
    rollbackDecisionOwner: string;
    snapshotExport: ApprovalValue;
    state: ApprovalState;
  };
  eventualTarget: { deployment: string; deploymentClass: "production" };
  fileStorage: { decision: "include" } | { decision: "exclude-reviewed"; reviewedReason: string };
  functions: { backfill: string; status: string; verify: string };
  migrationName: string;
  ordinaryPreviewNames: string[];
  rehearsal: {
    deployment: string;
    deploymentClass: "dedicated-preview";
    previewName: string;
  };
  revisions: { narrow: string; preChange: string; widen: string };
  runId: string;
  schemaVersion: 1;
  snapshot: {
    path: string;
    retentionHours: number;
    retentionOwner: string;
  };
  source: { deployment: string; deploymentClass: SourceDeploymentClass };
}

export interface MigrationRehearsalEvidence {
  migrationName: string;
  outcomes: {
    backfill: (typeof EVIDENCE_OUTCOMES)[number];
    narrowDeploy: (typeof EVIDENCE_OUTCOMES)[number];
    smoke: (typeof EVIDENCE_OUTCOMES)[number];
    verify: (typeof EVIDENCE_OUTCOMES)[number];
    widenDeploy: (typeof EVIDENCE_OUTCOMES)[number];
  };
  previewName: string;
  revision: string;
  runId: string;
  schemaVersion: 1;
  snapshot: { createdAt: string; sha256: string };
  status: {
    key: string;
    legacyRemaining: number;
    processed: number;
    stage: string;
    status: string;
    verified: boolean;
  };
  targetClass: "dedicated-preview";
}

export interface MigrationRehearsalPlanStep {
  argv?: string[];
  executesProduction: false;
  execution: "blocked";
  id: string;
  note: string;
  requiredRevision?: string;
}

function isRecord(value: JsonValue): value is JsonObject {
  return isRuntimeObject(value) && value !== null && !Array.isArray(value);
}

function assertRecord(value: JsonValue, label: string): asserts value is JsonObject {
  if (!isRecord(value)) {
    throw new Error(`${label} must be an object`);
  }
}

function assertExactKeys(value: JsonObject, keys: readonly string[], label: string) {
  const expected = new Set(keys);
  for (const key of Object.keys(value)) {
    if (!expected.has(key)) {
      throw new Error(`${label} contains unknown field ${key}`);
    }
  }
  for (const key of keys) {
    if (!(key in value)) {
      throw new Error(`${label} is missing ${key}`);
    }
  }
}

function assertNoSensitiveFields(value: JsonValue, path = "manifest") {
  if (Array.isArray(value)) {
    for (const [index, entry] of value.entries()) {
      assertNoSensitiveFields(entry, `${path}[${index}]`);
    }
    return;
  }
  if (!isRecord(value)) {
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      throw new Error(`${path} must not contain secret or row payload field ${key}`);
    }
    assertNoSensitiveFields(entry, `${path}.${key}`);
  }
}

function requiredString(value: JsonValue, label: string, pattern?: RegExp) {
  if (!(isRuntimeString(value) && value.trim())) {
    throw new Error(`${label} must be a non-empty string`);
  }
  if (pattern && !pattern.test(value)) {
    throw new Error(`${label} has an unsafe format`);
  }
  return value;
}

function enumValue<const Values extends readonly string[]>(
  value: JsonValue,
  values: Values,
  label: string
): Values[number] {
  if (!(isRuntimeString(value) && values.includes(value))) {
    throw new Error(`${label} must be one of: ${values.join(", ")}`);
  }
  return value;
}

function nonnegativeInteger(value: JsonValue, label: string) {
  if (!(isRuntimeNumber(value) && Number.isInteger(value)) || value < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
  return value;
}

function validateApproval(value: JsonValue): MigrationRehearsalManifest["approval"] {
  assertRecord(value, "approval");
  assertExactKeys(
    value,
    ["rollbackDecisionOwner", "snapshotExport", "rehearsalImport", "productionPromotion", "state"],
    "approval"
  );
  const approval = {
    productionPromotion: enumValue(
      value.productionPromotion,
      APPROVAL_VALUES,
      "approval.productionPromotion"
    ),
    rehearsalImport: enumValue(value.rehearsalImport, APPROVAL_VALUES, "approval.rehearsalImport"),
    rollbackDecisionOwner: requiredString(
      value.rollbackDecisionOwner,
      "approval.rollbackDecisionOwner"
    ),
    snapshotExport: enumValue(value.snapshotExport, APPROVAL_VALUES, "approval.snapshotExport"),
    state: enumValue(value.state, APPROVAL_STATES, "approval.state"),
  };
  if (
    approval.state !== "draft" &&
    (approval.snapshotExport !== "approved" || approval.rehearsalImport !== "approved")
  ) {
    throw new Error("rehearsal approval requires approved snapshot export and rehearsal import");
  }
  if (approval.state === "production-approved" && approval.productionPromotion !== "approved") {
    throw new Error("production approval requires an approved production promotion");
  }
  return approval;
}

function validateRevision(value: JsonValue, label: string, state: ApprovalState) {
  const revision = requiredString(value, label, SAFE_IDENTIFIER_PATTERN);
  if (state !== "draft" && !GIT_SHA_PATTERN.test(revision)) {
    throw new Error(`${label} must be an immutable Git SHA after rehearsal approval`);
  }
  return revision;
}

export function validateMigrationRehearsalManifest(value: JsonValue): MigrationRehearsalManifest {
  assertNoSensitiveFields(value);
  assertRecord(value, "migration rehearsal manifest");
  assertExactKeys(
    value,
    [
      "schemaVersion",
      "runId",
      "migrationName",
      "source",
      "rehearsal",
      "eventualTarget",
      "revisions",
      "fileStorage",
      "snapshot",
      "functions",
      "approval",
      "ordinaryPreviewNames",
    ],
    "migration rehearsal manifest"
  );
  if (value.schemaVersion !== 1) {
    throw new Error("migration rehearsal manifest must use schemaVersion 1");
  }
  const runId = requiredString(value.runId, "runId", SAFE_SLUG_PATTERN);
  const migrationName = requiredString(value.migrationName, "migrationName", SAFE_SLUG_PATTERN);
  const approval = validateApproval(value.approval);

  assertRecord(value.source, "source");
  assertExactKeys(value.source, ["deployment", "deploymentClass"], "source");
  const source = {
    deployment: requiredString(
      value.source.deployment,
      "source.deployment",
      SAFE_IDENTIFIER_PATTERN
    ),
    deploymentClass: enumValue(
      value.source.deploymentClass,
      DEPLOYMENT_CLASSES,
      "source.deploymentClass"
    ),
  };

  assertRecord(value.rehearsal, "rehearsal");
  assertExactKeys(value.rehearsal, ["deployment", "deploymentClass", "previewName"], "rehearsal");
  if (value.rehearsal.deploymentClass !== "dedicated-preview") {
    throw new Error("rehearsal must use the dedicated-preview deployment class");
  }
  const rehearsal = {
    deployment: requiredString(
      value.rehearsal.deployment,
      "rehearsal.deployment",
      SAFE_IDENTIFIER_PATTERN
    ),
    deploymentClass: "dedicated-preview" as const,
    previewName: requiredString(
      value.rehearsal.previewName,
      "rehearsal.previewName",
      SAFE_SLUG_PATTERN
    ),
  };

  if (!Array.isArray(value.ordinaryPreviewNames)) {
    throw new Error("ordinaryPreviewNames must be an array");
  }
  const ordinaryPreviewNames = value.ordinaryPreviewNames.map((entry, index) =>
    requiredString(entry, `ordinaryPreviewNames[${index}]`, SAFE_SLUG_PATTERN)
  );
  if (ordinaryPreviewNames.includes(rehearsal.previewName)) {
    throw new Error("rehearsal.previewName must not reuse an ordinary Preview name");
  }
  const rehearsalPrefix = `migration-rehearsal-${migrationName}-`;
  if (rehearsal.previewName.slice(0, rehearsalPrefix.length) !== rehearsalPrefix) {
    throw new Error("rehearsal.previewName must use the protected prefix for this migration");
  }

  assertRecord(value.eventualTarget, "eventualTarget");
  assertExactKeys(value.eventualTarget, ["deployment", "deploymentClass"], "eventualTarget");
  if (value.eventualTarget.deploymentClass !== "production") {
    throw new Error("eventualTarget must classify Production explicitly");
  }
  const eventualTarget = {
    deployment: requiredString(
      value.eventualTarget.deployment,
      "eventualTarget.deployment",
      SAFE_IDENTIFIER_PATTERN
    ),
    deploymentClass: "production" as const,
  };

  assertRecord(value.revisions, "revisions");
  assertExactKeys(value.revisions, ["preChange", "widen", "narrow"], "revisions");
  const revisions = {
    narrow: validateRevision(value.revisions.narrow, "revisions.narrow revision", approval.state),
    preChange: validateRevision(
      value.revisions.preChange,
      "revisions.preChange revision",
      approval.state
    ),
    widen: validateRevision(value.revisions.widen, "revisions.widen revision", approval.state),
  };

  assertRecord(value.fileStorage, "fileStorage");
  const decision = enumValue(
    value.fileStorage.decision,
    ["include", "exclude-reviewed"] as const,
    "file-storage decision"
  );
  let fileStorage: MigrationRehearsalManifest["fileStorage"];
  if (decision === "include") {
    assertExactKeys(value.fileStorage, ["decision"], "fileStorage");
    fileStorage = { decision };
  } else {
    assertExactKeys(value.fileStorage, ["decision", "reviewedReason"], "fileStorage");
    fileStorage = {
      decision,
      reviewedReason: requiredString(
        value.fileStorage.reviewedReason,
        "fileStorage reviewed reason"
      ),
    };
  }

  assertRecord(value.snapshot, "snapshot");
  assertExactKeys(value.snapshot, ["path", "retentionHours", "retentionOwner"], "snapshot");
  const expectedSnapshotPath = `.scratch/migration-rehearsal/${runId}/snapshot.zip`;
  if (value.snapshot.path !== expectedSnapshotPath) {
    throw new Error(`snapshot path must be exactly ${expectedSnapshotPath}`);
  }
  const retentionHours = nonnegativeInteger(
    value.snapshot.retentionHours,
    "snapshot.retentionHours"
  );
  if (retentionHours < 1 || retentionHours > 168) {
    throw new Error("snapshot.retentionHours must be from 1 to 168 hours");
  }
  const snapshot = {
    path: expectedSnapshotPath,
    retentionHours,
    retentionOwner: requiredString(value.snapshot.retentionOwner, "snapshot.retentionOwner"),
  };

  assertRecord(value.functions, "functions");
  assertExactKeys(value.functions, ["backfill", "status", "verify"], "functions");
  const functions = {
    backfill: requiredString(value.functions.backfill, "functions.backfill", SAFE_FUNCTION_PATTERN),
    status: requiredString(value.functions.status, "functions.status", SAFE_FUNCTION_PATTERN),
    verify: requiredString(value.functions.verify, "functions.verify", SAFE_FUNCTION_PATTERN),
  };

  return {
    approval,
    eventualTarget,
    fileStorage,
    functions,
    migrationName,
    ordinaryPreviewNames,
    rehearsal,
    revisions,
    runId,
    schemaVersion: 1,
    snapshot,
    source,
  };
}

function blockedStep(
  id: string,
  note: string,
  options: { argv?: string[]; requiredRevision?: string } = {}
): MigrationRehearsalPlanStep {
  return {
    ...options,
    executesProduction: false,
    execution: "blocked",
    id,
    note,
  };
}

export function buildMigrationRehearsalPlan(manifest: MigrationRehearsalManifest) {
  const exportArgs = [
    "bunx",
    "convex",
    "export",
    "--deployment",
    manifest.source.deployment,
    "--path",
    manifest.snapshot.path,
  ];
  if (manifest.fileStorage.decision === "include") {
    exportArgs.push("--include-file-storage");
  }
  const rehearsalArgs = ["--deployment", manifest.rehearsal.deployment];
  const protectedFunctionArgs = "<protected-migration-arguments>";
  const steps = [
    blockedStep(
      "export-source-snapshot",
      "Read-only export; requires explicit snapshot authority.",
      {
        argv: exportArgs,
        requiredRevision: manifest.revisions.preChange,
      }
    ),
    blockedStep(
      "create-dedicated-preview",
      "Requires a Preview deploy key and creates or recreates only the protected rehearsal Preview.",
      {
        argv: ["bunx", "convex", "deploy", "--preview-create", manifest.rehearsal.previewName],
        requiredRevision: manifest.revisions.preChange,
      }
    ),
    blockedStep("import-snapshot", "Destructive only to the dedicated rehearsal Preview.", {
      argv: ["bunx", "convex", "import", manifest.snapshot.path, "--replace-all", ...rehearsalArgs],
      requiredRevision: manifest.revisions.preChange,
    }),
    blockedStep(
      "deploy-widened-revision",
      "Reuse the same protected Preview; never recreate here.",
      {
        argv: ["bunx", "convex", "deploy", "--preview-name", manifest.rehearsal.previewName],
        requiredRevision: manifest.revisions.widen,
      }
    ),
    blockedStep("read-initial-status", "Record the migration state before any write.", {
      argv: [
        "bunx",
        "convex",
        "run",
        manifest.functions.status,
        protectedFunctionArgs,
        ...rehearsalArgs,
      ],
      requiredRevision: manifest.revisions.widen,
    }),
    blockedStep(
      "run-backfill",
      "Run bounded pages until the server-owned state advances to verify.",
      {
        argv: [
          "bunx",
          "convex",
          "run",
          manifest.functions.backfill,
          protectedFunctionArgs,
          ...rehearsalArgs,
        ],
        requiredRevision: manifest.revisions.widen,
      }
    ),
    blockedStep(
      "run-independent-verifier",
      "Run bounded independent verification until zero residual rows are recorded.",
      {
        argv: [
          "bunx",
          "convex",
          "run",
          manifest.functions.verify,
          protectedFunctionArgs,
          ...rehearsalArgs,
        ],
        requiredRevision: manifest.revisions.widen,
      }
    ),
    blockedStep("read-final-status", "Require verified=true and zero residuals.", {
      argv: [
        "bunx",
        "convex",
        "run",
        manifest.functions.status,
        protectedFunctionArgs,
        ...rehearsalArgs,
      ],
      requiredRevision: manifest.revisions.widen,
    }),
    blockedStep(
      "deploy-narrow-revision",
      "Exercise the schema conformance gate on the same Preview.",
      {
        argv: ["bunx", "convex", "deploy", "--preview-name", manifest.rehearsal.previewName],
        requiredRevision: manifest.revisions.narrow,
      }
    ),
    blockedStep(
      "run-authenticated-smoke",
      "Use separately supplied least-privilege identities; do not record credentials or customer data."
    ),
    blockedStep(
      "record-rehearsal-evidence",
      "Record only the schema-versioned content-free evidence contract."
    ),
    blockedStep(
      "request-fresh-production-approval",
      `Production ${manifest.eventualTarget.deployment} remains blocked; repeat only after a fresh explicit approval.`
    ),
    blockedStep(
      "securely-delete-snapshot",
      `The retention owner must remove ${manifest.snapshot.path} within ${manifest.snapshot.retentionHours} hours and record completion.`
    ),
  ];
  return {
    approval: manifest.approval,
    eventualTarget: manifest.eventualTarget,
    migrationName: manifest.migrationName,
    rehearsal: manifest.rehearsal,
    runId: manifest.runId,
    schemaVersion: 1 as const,
    scope: "planning-only" as const,
    snapshot: manifest.snapshot,
    source: manifest.source,
    steps,
  };
}

function validateOutcome(value: JsonValue, label: string) {
  return enumValue(value, EVIDENCE_OUTCOMES, label);
}

export function validateMigrationRehearsalEvidence(value: JsonValue): MigrationRehearsalEvidence {
  assertNoSensitiveFields(value, "evidence");
  assertRecord(value, "migration rehearsal evidence");
  assertExactKeys(
    value,
    [
      "schemaVersion",
      "runId",
      "migrationName",
      "targetClass",
      "previewName",
      "revision",
      "snapshot",
      "outcomes",
      "status",
    ],
    "migration rehearsal evidence"
  );
  if (value.schemaVersion !== 1 || value.targetClass !== "dedicated-preview") {
    throw new Error("migration rehearsal evidence must use schemaVersion 1 and dedicated-preview");
  }
  assertRecord(value.snapshot, "evidence.snapshot");
  assertExactKeys(value.snapshot, ["createdAt", "sha256"], "evidence.snapshot");
  const createdAt = requiredString(value.snapshot.createdAt, "evidence.snapshot.createdAt");
  if (Number.isNaN(Date.parse(createdAt))) {
    throw new Error("evidence.snapshot.createdAt must be an ISO timestamp");
  }
  const sha256 = requiredString(value.snapshot.sha256, "evidence.snapshot.sha256", SHA256_PATTERN);

  assertRecord(value.outcomes, "evidence.outcomes");
  assertExactKeys(
    value.outcomes,
    ["widenDeploy", "backfill", "verify", "narrowDeploy", "smoke"],
    "evidence.outcomes"
  );
  const outcomes = {
    backfill: validateOutcome(value.outcomes.backfill, "evidence.outcomes.backfill"),
    narrowDeploy: validateOutcome(value.outcomes.narrowDeploy, "evidence.outcomes.narrowDeploy"),
    smoke: validateOutcome(value.outcomes.smoke, "evidence.outcomes.smoke"),
    verify: validateOutcome(value.outcomes.verify, "evidence.outcomes.verify"),
    widenDeploy: validateOutcome(value.outcomes.widenDeploy, "evidence.outcomes.widenDeploy"),
  };

  assertRecord(value.status, "evidence.status");
  assertExactKeys(
    value.status,
    ["key", "legacyRemaining", "processed", "stage", "status", "verified"],
    "evidence.status"
  );
  const status = {
    key: requiredString(value.status.key, "evidence.status.key", SAFE_SLUG_PATTERN),
    legacyRemaining: nonnegativeInteger(
      value.status.legacyRemaining,
      "evidence.status.legacyRemaining"
    ),
    processed: nonnegativeInteger(value.status.processed, "evidence.status.processed"),
    stage: requiredString(value.status.stage, "evidence.status.stage", SAFE_IDENTIFIER_PATTERN),
    status: requiredString(value.status.status, "evidence.status.status", SAFE_IDENTIFIER_PATTERN),
    verified: value.status.verified,
  };
  if (!isRuntimeBoolean(status.verified)) {
    throw new Error("evidence.status.verified must be boolean");
  }

  return {
    migrationName: requiredString(value.migrationName, "evidence.migrationName", SAFE_SLUG_PATTERN),
    outcomes,
    previewName: requiredString(value.previewName, "evidence.previewName", SAFE_SLUG_PATTERN),
    revision: requiredString(value.revision, "evidence.revision", GIT_SHA_PATTERN),
    runId: requiredString(value.runId, "evidence.runId", SAFE_SLUG_PATTERN),
    schemaVersion: 1,
    snapshot: { createdAt, sha256 },
    status,
    targetClass: "dedicated-preview",
  };
}

function renderHumanPlan(plan: ReturnType<typeof buildMigrationRehearsalPlan>) {
  return [
    `Migration rehearsal plan: ${plan.migrationName} (${plan.runId})`,
    `Source: ${plan.source.deploymentClass}/${plan.source.deployment}`,
    `Rehearsal: dedicated-preview/${plan.rehearsal.previewName}`,
    `Eventual target: production/${plan.eventualTarget.deployment} (blocked)`,
    "Scope: planning-only; no command below was executed.",
    ...plan.steps.map((step, index) => {
      const command = step.argv ? ` | ${step.argv.join(" ")}` : "";
      const revision = step.requiredRevision ? ` | revision ${step.requiredRevision}` : "";
      return `${index + 1}. ${step.id}${revision}${command}\n   ${step.note}`;
    }),
  ].join("\n");
}

if (import.meta.main) {
  try {
    const parsed = parseCliArguments(process.argv.slice(2), MIGRATION_REHEARSAL_CLI);
    if (parsed.help) {
      console.log(formatCliHelp(MIGRATION_REHEARSAL_CLI));
    } else {
      if (!isRuntimeString(parsed.values.manifest)) {
        throw new Error("--manifest is required");
      }
      const manifest = validateMigrationRehearsalManifest(
        JSON.parse(readFileSync(parsed.values.manifest, "utf8"))
      );
      const plan = buildMigrationRehearsalPlan(manifest);
      console.log(parsed.values.json ? JSON.stringify(plan, null, 2) : renderHumanPlan(plan));
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Migration rehearsal planning failed");
    process.exitCode = 1;
  }
}
