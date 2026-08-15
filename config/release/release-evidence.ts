import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import type { LocalVerificationMetrics } from "./verify-local";

export const RELEASE_EVIDENCE_SCOPES = [
  "local",
  "git-push",
  "preview-deploy",
  "preview-public-smoke",
  "preview-authenticated-smoke",
  "production-deploy",
  "production-public-smoke",
  "production-authenticated-smoke",
  "migration",
] as const;

export type ReleaseEvidenceScopeId = (typeof RELEASE_EVIDENCE_SCOPES)[number];
export type ReleaseEvidenceStatus = "blocked" | "failed" | "not_run" | "passed";

export interface ReleaseEvidenceCheck {
  artifactRefs: string[];
  durationMs: number;
  id: string;
  outcome: "failed" | "passed" | "skipped";
  reason?: string;
}

export interface ReleaseEvidenceScope {
  checks: ReleaseEvidenceCheck[];
  command: string | null;
  finishedAt: string | null;
  reason: string | null;
  startedAt: string | null;
  status: ReleaseEvidenceStatus;
  target: { id: string; kind: "local" | "preview" | "production" } | null;
}

export interface ReleaseEvidenceBundle {
  createdAt: string;
  revision: string;
  schemaVersion: 1;
  scopes: Record<ReleaseEvidenceScopeId, ReleaseEvidenceScope>;
}

const SAFE_ID_PATTERN = /^[A-Za-z0-9._/+:-]+$/;
const SAFE_ARTIFACT_REF_PATTERN = /^[A-Za-z0-9._/+-]+$/;
const PRODUCTION_LIKE_ID_PATTERN = /production|(^|[-_.])prod($|[-_.])/i;
const SENSITIVE_VALUE_PATTERN = /(?:api[-_]?key|password|secret|token)\s*[:=]\s*\S+/i;
const EXECUTED_STATUSES = new Set<ReleaseEvidenceStatus>(["failed", "passed"]);
type ReleaseEvidenceTargetKind = NonNullable<ReleaseEvidenceScope["target"]>["kind"];
const SCOPE_TARGET_KINDS: Record<ReleaseEvidenceScopeId, readonly ReleaseEvidenceTargetKind[]> = {
  "git-push": ["local"],
  local: ["local"],
  migration: ["preview", "production"],
  "preview-authenticated-smoke": ["preview"],
  "preview-deploy": ["preview"],
  "preview-public-smoke": ["preview"],
  "production-authenticated-smoke": ["production"],
  "production-deploy": ["production"],
  "production-public-smoke": ["production"],
};

function notRunScope(): ReleaseEvidenceScope {
  return {
    checks: [],
    command: null,
    finishedAt: null,
    reason: "not recorded by this command adapter",
    startedAt: null,
    status: "not_run",
    target: null,
  };
}

function createEmptyReleaseEvidence(revision: string, createdAt: string): ReleaseEvidenceBundle {
  const scopes = Object.fromEntries(
    RELEASE_EVIDENCE_SCOPES.map((scope) => [scope, notRunScope()])
  ) as Record<ReleaseEvidenceScopeId, ReleaseEvidenceScope>;
  return { createdAt, revision, schemaVersion: 1, scopes };
}

function assertIsoTimestamp(value: unknown, path: string) {
  if (
    typeof value !== "string" ||
    Number.isNaN(Date.parse(value)) ||
    new Date(value).toISOString() !== value
  ) {
    throw new Error(`${path} must be an ISO timestamp`);
  }
  return value;
}

function assertSafeId(value: unknown, path: string) {
  if (typeof value !== "string" || !SAFE_ID_PATTERN.test(value)) {
    throw new Error(`${path} must be a redaction-safe identifier`);
  }
  return value;
}

function assertExactKeys(record: Record<string, unknown>, keys: readonly string[], path: string) {
  const expected = new Set(keys);
  for (const key of Object.keys(record)) {
    if (!expected.has(key)) {
      throw new Error(`${path}.${key} is not part of the release evidence schema`);
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertNullableSafeText(value: unknown, path: string, maximumLength: number) {
  if (value === null) {
    return null;
  }
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > maximumLength ||
    Array.from(value).some((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127;
    }) ||
    SENSITIVE_VALUE_PATTERN.test(value)
  ) {
    throw new Error(`${path} must be bounded redaction-safe text or null`);
  }
  return value;
}

function parseArtifactRef(value: unknown, path: string) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 240 ||
    !SAFE_ARTIFACT_REF_PATTERN.test(value) ||
    value.startsWith("/") ||
    value.split("/").includes("..")
  ) {
    throw new Error(`${path} must be a safe workspace-relative artifact reference`);
  }
  return value;
}

function parseReleaseEvidenceCheck(raw: unknown, path: string): ReleaseEvidenceCheck {
  if (!isRecord(raw)) {
    throw new Error(`${path} must be an object`);
  }
  assertExactKeys(raw, ["artifactRefs", "durationMs", "id", "outcome", "reason"], path);
  if (!Array.isArray(raw.artifactRefs)) {
    throw new Error(`${path}.artifactRefs must be an array`);
  }
  const artifactRefs = raw.artifactRefs.map((value, index) =>
    parseArtifactRef(value, `${path}.artifactRefs[${index}]`)
  );
  if (new Set(artifactRefs).size !== artifactRefs.length) {
    throw new Error(`${path}.artifactRefs must not contain duplicates`);
  }
  if (
    typeof raw.durationMs !== "number" ||
    !Number.isFinite(raw.durationMs) ||
    raw.durationMs < 0
  ) {
    throw new Error(`${path}.durationMs must be a finite non-negative number`);
  }
  const id = assertSafeId(raw.id, `${path}.id`);
  if (!(raw.outcome === "failed" || raw.outcome === "passed" || raw.outcome === "skipped")) {
    throw new Error(`${path}.outcome is invalid`);
  }
  const reason = assertNullableSafeText(raw.reason ?? null, `${path}.reason`, 500);
  if ((raw.outcome === "failed" || raw.outcome === "skipped") && !reason) {
    throw new Error(`${path}.reason is required for ${raw.outcome}`);
  }
  if (raw.outcome === "passed" && reason) {
    throw new Error(`${path}.reason must be absent for passed checks`);
  }
  return {
    artifactRefs,
    durationMs: raw.durationMs,
    id,
    outcome: raw.outcome,
    ...(reason ? { reason } : {}),
  };
}

function parseTarget(
  raw: unknown,
  scopeId: ReleaseEvidenceScopeId,
  path: string
): ReleaseEvidenceScope["target"] {
  if (raw === null) {
    return null;
  }
  if (!isRecord(raw)) {
    throw new Error(`${path} must be an object or null`);
  }
  assertExactKeys(raw, ["id", "kind"], path);
  if (!(raw.kind === "local" || raw.kind === "preview" || raw.kind === "production")) {
    throw new Error(`${path}.kind is invalid`);
  }
  const id = assertSafeId(raw.id, `${path}.id`);
  if (!SCOPE_TARGET_KINDS[scopeId].includes(raw.kind)) {
    throw new Error(`${path}.kind is incompatible with ${scopeId}`);
  }
  if (raw.kind === "preview" && !id.startsWith("preview-")) {
    throw new Error(`${path}.id must begin with preview- for Preview evidence`);
  }
  if (raw.kind === "preview" && PRODUCTION_LIKE_ID_PATTERN.test(id)) {
    throw new Error(`${path}.id cannot be Production-like for Preview evidence`);
  }
  if (raw.kind === "production" && !id.startsWith("production-")) {
    throw new Error(`${path}.id must begin with production- for Production evidence`);
  }
  return { id, kind: raw.kind };
}

function parseReleaseEvidenceStatus(value: unknown, path: string): ReleaseEvidenceStatus {
  if (!(value === "blocked" || value === "failed" || value === "not_run" || value === "passed")) {
    throw new Error(`${path}.status is invalid`);
  }
  return value;
}

function assertNonExecutionStatus(args: {
  command: string | null;
  finishedAt: string | null;
  path: string;
  reason: string | null;
  startedAt: string | null;
  status: ReleaseEvidenceStatus;
  target: ReleaseEvidenceScope["target"];
}) {
  if (
    (args.status === "blocked" || args.status === "failed" || args.status === "not_run") &&
    !args.reason
  ) {
    throw new Error(`${args.path}.reason is required for ${args.status}`);
  }
  if (args.status === "passed" && args.reason) {
    throw new Error(`${args.path}.reason must be null for passed evidence`);
  }
  if (
    (args.status === "blocked" || args.status === "not_run") &&
    (args.command || args.startedAt || args.finishedAt || args.target)
  ) {
    throw new Error(`${args.path} cannot claim execution or a target while ${args.status}`);
  }
}

function assertExecutedScope(args: {
  checks: ReleaseEvidenceCheck[];
  command: string | null;
  finishedAt: string | null;
  path: string;
  startedAt: string | null;
  status: ReleaseEvidenceStatus;
  target: ReleaseEvidenceScope["target"];
}) {
  if (!EXECUTED_STATUSES.has(args.status)) {
    return;
  }
  if (
    !(args.command && args.startedAt && args.finishedAt && args.target && args.checks.length > 0)
  ) {
    throw new Error(
      `${args.path} executed evidence requires command, timestamps, target, and checks`
    );
  }
  if (Date.parse(args.finishedAt) < Date.parse(args.startedAt)) {
    throw new Error(`${args.path}.finishedAt cannot precede startedAt`);
  }
}

function assertScopeCheckOutcomes(
  status: ReleaseEvidenceStatus,
  checks: ReleaseEvidenceCheck[],
  path: string
) {
  if ((status === "blocked" || status === "not_run") && checks.length > 0) {
    throw new Error(`${path}.checks must be empty while ${status}`);
  }
  if (status === "passed" && checks.some((check) => check.outcome !== "passed")) {
    throw new Error(`${path} passed evidence may contain only passed checks`);
  }
  if (status === "failed" && !checks.some((check) => check.outcome === "failed")) {
    throw new Error(`${path} failed evidence requires at least one failed check`);
  }
}

export function createLocalReleaseEvidence(
  metrics: LocalVerificationMetrics,
  createdAt = new Date().toISOString()
): ReleaseEvidenceBundle {
  const finishedAtMs = Date.parse(metrics.startedAt) + Math.round(metrics.totalDurationMs);
  const evidenceCreatedAt = new Date(Math.max(Date.parse(createdAt), finishedAtMs)).toISOString();
  const bundle = createEmptyReleaseEvidence(metrics.revision, evidenceCreatedAt);
  const { scopes } = bundle;
  scopes.local = {
    checks: metrics.gates.map((gate) => {
      const reason = gate.reason ?? (gate.outcome === "failed" ? `gate ${gate.id} failed` : null);
      return {
        artifactRefs: [],
        durationMs: gate.durationMs,
        id: gate.id,
        outcome: gate.outcome,
        ...(reason ? { reason } : {}),
      };
    }),
    command: "bun run verify:local",
    finishedAt: new Date(finishedAtMs).toISOString(),
    reason: metrics.failedGate ? `gate ${metrics.failedGate} failed` : null,
    startedAt: metrics.startedAt,
    status: metrics.outcome,
    target: { id: "working-tree", kind: "local" },
  };
  return bundle;
}

export function createPreviewPublicSmokeEvidence(args: {
  artifactRefs: string[];
  finishedAt: string;
  outcome: "failed" | "passed";
  reason?: string;
  revision: string;
  startedAt: string;
  targetId: string;
}) {
  const bundle = createEmptyReleaseEvidence(args.revision, args.finishedAt);
  bundle.scopes["preview-public-smoke"] = {
    checks: [
      {
        artifactRefs: args.artifactRefs,
        durationMs: Math.max(0, Date.parse(args.finishedAt) - Date.parse(args.startedAt)),
        id: "public-interface-accessibility",
        outcome: args.outcome,
        ...(args.reason ? { reason: args.reason } : {}),
      },
    ],
    command: "bun run browser:evidence:preview-public",
    finishedAt: args.finishedAt,
    reason: args.reason ?? null,
    startedAt: args.startedAt,
    status: args.outcome,
    target: { id: args.targetId, kind: "preview" },
  };
  return bundle;
}

function parseReleaseEvidenceScope(raw: unknown, scopeId: ReleaseEvidenceScopeId) {
  if (!isRecord(raw)) {
    throw new Error(`evidence.scopes.${scopeId} must be an object`);
  }
  const scope = raw;
  const path = `evidence.scopes.${scopeId}`;
  assertExactKeys(
    scope,
    ["checks", "command", "finishedAt", "reason", "startedAt", "status", "target"],
    path
  );
  const { checks: rawChecks } = scope;
  const status = parseReleaseEvidenceStatus(scope.status, path);
  const command = assertNullableSafeText(scope.command, `${path}.command`, 300);
  const reason = assertNullableSafeText(scope.reason, `${path}.reason`, 500);
  const startedAt =
    scope.startedAt === null ? null : assertIsoTimestamp(scope.startedAt, `${path}.startedAt`);
  const finishedAt =
    scope.finishedAt === null ? null : assertIsoTimestamp(scope.finishedAt, `${path}.finishedAt`);
  const target = parseTarget(scope.target, scopeId, `${path}.target`);
  assertNonExecutionStatus({ command, finishedAt, path, reason, startedAt, status, target });
  if (!Array.isArray(rawChecks)) {
    throw new Error(`${path}.checks must be an array`);
  }
  const checks = rawChecks.map((check, index) =>
    parseReleaseEvidenceCheck(check, `${path}.checks[${index}]`)
  );
  if (new Set(checks.map((check) => check.id)).size !== checks.length) {
    throw new Error(`${path}.checks must use unique IDs`);
  }
  assertExecutedScope({ checks, command, finishedAt, path, startedAt, status, target });
  assertScopeCheckOutcomes(status, checks, path);
  return { checks, command, finishedAt, reason, startedAt, status, target };
}

export function parseReleaseEvidence(value: unknown): ReleaseEvidenceBundle {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("release evidence must be an object");
  }
  const bundle = value as Record<string, unknown>;
  assertExactKeys(bundle, ["createdAt", "revision", "schemaVersion", "scopes"], "evidence");
  if (bundle.schemaVersion !== 1) {
    throw new Error("evidence.schemaVersion must be 1");
  }
  const createdAt = assertIsoTimestamp(bundle.createdAt, "evidence.createdAt");
  const revision = assertSafeId(bundle.revision, "evidence.revision");
  if (!bundle.scopes || typeof bundle.scopes !== "object" || Array.isArray(bundle.scopes)) {
    throw new Error("evidence.scopes must be an object");
  }
  const scopeRecord = bundle.scopes as Record<string, unknown>;
  assertExactKeys(scopeRecord, RELEASE_EVIDENCE_SCOPES, "evidence.scopes");
  const scopes = {} as Record<ReleaseEvidenceScopeId, ReleaseEvidenceScope>;
  for (const scopeId of RELEASE_EVIDENCE_SCOPES) {
    scopes[scopeId] = parseReleaseEvidenceScope(scopeRecord[scopeId], scopeId);
  }
  const createdAtMs = Date.parse(createdAt);
  for (const scopeId of RELEASE_EVIDENCE_SCOPES) {
    const { finishedAt } = scopes[scopeId];
    if (finishedAt && Date.parse(finishedAt) > createdAtMs) {
      throw new Error(`evidence.createdAt cannot precede evidence.scopes.${scopeId}.finishedAt`);
    }
  }
  return { createdAt, revision, schemaVersion: 1, scopes };
}

export function summarizeReleaseEvidence(bundle: ReleaseEvidenceBundle) {
  const parsed = parseReleaseEvidence(bundle);
  return [
    `Release evidence ${parsed.revision} (${parsed.createdAt})`,
    ...RELEASE_EVIDENCE_SCOPES.map((scope) => {
      const evidence = parsed.scopes[scope];
      const detail = evidence.reason ? ` - ${evidence.reason}` : "";
      return `${scope}: ${evidence.status}${detail}`;
    }),
  ].join("\n");
}

function safePathSegment(value: string) {
  return value.replaceAll(/[^A-Za-z0-9._+-]/g, "-");
}

export function writeReleaseEvidence(
  root: string,
  option: string,
  evidence: ReleaseEvidenceBundle,
  write: (value: string) => void = console.log
) {
  const parsed = parseReleaseEvidence(evidence);
  const serialized = `${JSON.stringify(parsed, null, 2)}\n`;
  if (option === "-") {
    write(serialized.trimEnd());
    return null;
  }
  const outputPath =
    option === "auto"
      ? resolve(
          root,
          ".scratch/release-evidence",
          safePathSegment(parsed.revision),
          `${parsed.createdAt.replaceAll(/[:.]/g, "-")}.json`
        )
      : resolve(root, option);
  const evidenceRoot = resolve(root, ".scratch/release-evidence");
  const relativeOutput = relative(evidenceRoot, outputPath);
  if (!relativeOutput || relativeOutput.startsWith("..") || outputPath === evidenceRoot) {
    throw new Error("--evidence must name a file under .scratch/release-evidence, auto, or -");
  }
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, serialized);
  return outputPath;
}
