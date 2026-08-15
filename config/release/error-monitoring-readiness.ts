import { type ApprovedE2eTarget, validateApprovedE2eTargetManifest } from "../e2e/target-identity";

const SYNTHETIC_CHECKS = [
  "next-server",
  "react-boundary",
  "unhandled-rejection",
  "window-error",
  "provider-alert",
] as const;

export type ErrorMonitoringReadinessStatus =
  | "preview_configuration_ready"
  | "preview_verified"
  | "provider_selection_required";

export interface ErrorMonitoringReadiness {
  ownership: {
    costOwner: null | string;
    incidentOwner: null | string;
    operationsOwner: null | string;
    privacyOwner: null | string;
  };
  policy: {
    maxEventBytes: null | number;
    perSourceEventsPerMinute: null | number;
    redactionPolicyVersion: null | string;
    retentionDays: null | number;
    sampleRate: null | number;
    sourceMaps: "disabled" | "private-provider-only" | "undecided";
  };
  previewEvidence: null | {
    syntheticChecks: (typeof SYNTHETIC_CHECKS)[number][];
    target: ApprovedE2eTarget;
  };
  provider: null | string;
  schemaVersion: 1;
  status: ErrorMonitoringReadinessStatus;
}

function record(value: unknown, path: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${path} must be an object`);
  }
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[], path: string) {
  const expected = new Set(keys);
  const unexpected = Object.keys(value).find((key) => !expected.has(key));
  if (unexpected) {
    throw new Error(`${path}.${unexpected} is not an allowed field`);
  }
}

function nullableOwner(value: unknown, path: string) {
  if (value === null) {
    return null;
  }
  if (typeof value !== "string" || value.trim().length === 0 || value.length > 120) {
    throw new Error(`${path} must be null or a bounded non-empty owner`);
  }
  return value;
}

function nullablePositiveInteger(value: unknown, path: string) {
  if (value === null) {
    return null;
  }
  if (!Number.isInteger(value) || (value as number) < 1) {
    throw new Error(`${path} must be null or a positive integer`);
  }
  return value as number;
}

function parsePreviewEvidence(value: unknown): ErrorMonitoringReadiness["previewEvidence"] {
  if (value === null) {
    return null;
  }
  record(value, "readiness.previewEvidence");
  exactKeys(value, ["syntheticChecks", "target"], "readiness.previewEvidence");
  const [target] = validateApprovedE2eTargetManifest({
    schemaVersion: 3,
    targets: [value.target],
  }).targets;
  if (target?.target !== "preview") {
    throw new Error(
      "readiness.previewEvidence.target must be a fully bound approved Preview target"
    );
  }
  if (!Array.isArray(value.syntheticChecks)) {
    throw new Error("readiness.previewEvidence.syntheticChecks must be an array");
  }
  const knownChecks = new Set<string>(SYNTHETIC_CHECKS);
  const syntheticChecks = value.syntheticChecks.map((check, index) => {
    if (typeof check !== "string" || !knownChecks.has(check)) {
      throw new Error(`readiness.previewEvidence.syntheticChecks[${index}] is unsupported`);
    }
    return check as (typeof SYNTHETIC_CHECKS)[number];
  });
  if (
    syntheticChecks.length !== SYNTHETIC_CHECKS.length ||
    new Set(syntheticChecks).size !== SYNTHETIC_CHECKS.length
  ) {
    throw new Error("readiness.previewEvidence must contain every synthetic check exactly once");
  }
  return { syntheticChecks, target };
}

export function parseErrorMonitoringReadiness(value: unknown): ErrorMonitoringReadiness {
  record(value, "readiness");
  exactKeys(
    value,
    ["ownership", "policy", "previewEvidence", "provider", "schemaVersion", "status"],
    "readiness"
  );
  if (value.schemaVersion !== 1) {
    throw new Error("readiness.schemaVersion must be 1");
  }
  if (
    !(
      value.status === "provider_selection_required" ||
      value.status === "preview_configuration_ready" ||
      value.status === "preview_verified"
    )
  ) {
    throw new Error("readiness.status is unsupported");
  }
  const provider = nullableOwner(value.provider, "readiness.provider");
  record(value.ownership, "readiness.ownership");
  exactKeys(
    value.ownership,
    ["costOwner", "incidentOwner", "operationsOwner", "privacyOwner"],
    "readiness.ownership"
  );
  const ownership = {
    costOwner: nullableOwner(value.ownership.costOwner, "readiness.ownership.costOwner"),
    incidentOwner: nullableOwner(
      value.ownership.incidentOwner,
      "readiness.ownership.incidentOwner"
    ),
    operationsOwner: nullableOwner(
      value.ownership.operationsOwner,
      "readiness.ownership.operationsOwner"
    ),
    privacyOwner: nullableOwner(value.ownership.privacyOwner, "readiness.ownership.privacyOwner"),
  };
  record(value.policy, "readiness.policy");
  exactKeys(
    value.policy,
    [
      "maxEventBytes",
      "perSourceEventsPerMinute",
      "redactionPolicyVersion",
      "retentionDays",
      "sampleRate",
      "sourceMaps",
    ],
    "readiness.policy"
  );
  if (
    !(
      value.policy.sourceMaps === "disabled" ||
      value.policy.sourceMaps === "private-provider-only" ||
      value.policy.sourceMaps === "undecided"
    )
  ) {
    throw new Error("readiness.policy.sourceMaps is unsupported");
  }
  if (
    !(
      value.policy.sampleRate === null ||
      (typeof value.policy.sampleRate === "number" &&
        Number.isFinite(value.policy.sampleRate) &&
        value.policy.sampleRate >= 0 &&
        value.policy.sampleRate <= 1)
    )
  ) {
    throw new Error("readiness.policy.sampleRate must be null or between zero and one");
  }
  const policy = {
    maxEventBytes: nullablePositiveInteger(
      value.policy.maxEventBytes,
      "readiness.policy.maxEventBytes"
    ),
    perSourceEventsPerMinute: nullablePositiveInteger(
      value.policy.perSourceEventsPerMinute,
      "readiness.policy.perSourceEventsPerMinute"
    ),
    redactionPolicyVersion: nullableOwner(
      value.policy.redactionPolicyVersion,
      "readiness.policy.redactionPolicyVersion"
    ),
    retentionDays: nullablePositiveInteger(
      value.policy.retentionDays,
      "readiness.policy.retentionDays"
    ),
    sampleRate: value.policy.sampleRate,
    sourceMaps: value.policy.sourceMaps,
  };

  const previewEvidence = parsePreviewEvidence(value.previewEvidence);

  const decisionComplete = Boolean(
    provider &&
      Object.values(ownership).every(Boolean) &&
      policy.maxEventBytes &&
      policy.perSourceEventsPerMinute &&
      policy.redactionPolicyVersion &&
      policy.retentionDays &&
      policy.sampleRate !== null &&
      policy.sourceMaps !== "undecided"
  );
  if (value.status === "provider_selection_required") {
    if (previewEvidence) {
      throw new Error("provider_selection_required readiness cannot contain Preview evidence");
    }
  } else if (!decisionComplete) {
    throw new Error(`${value.status} requires complete provider, ownership, and policy decisions`);
  }
  if (value.status === "preview_configuration_ready" && previewEvidence) {
    throw new Error("preview_configuration_ready cannot claim Preview verification evidence");
  }
  if (value.status === "preview_verified" && !previewEvidence) {
    throw new Error("preview_verified requires complete synthetic Preview evidence");
  }

  return {
    ownership,
    policy,
    previewEvidence,
    provider,
    schemaVersion: 1,
    status: value.status,
  };
}
