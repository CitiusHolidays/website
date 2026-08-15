import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { deprecatedPublicSiteUrlError, resolveAuthOrigin } from "../../convex/lib/authOriginPolicy";
import { formatCliHelp, parseCliArguments } from "../commands/cli";

export const ENVIRONMENT_TARGETS = ["preview", "production"] as const;
export type EnvironmentTarget = (typeof ENVIRONMENT_TARGETS)[number];

export const ENVIRONMENT_SCOPES = ["browser", "nextServer", "convexRuntime", "ciDeploy"] as const;
export type EnvironmentScope = (typeof ENVIRONMENT_SCOPES)[number];

interface EnvironmentRegistry {
  schemaVersion: 2;
  targets: Record<EnvironmentTarget, { scopes: Record<EnvironmentScope, { required: string[] }> }>;
}

export interface ConvexRuntimeEnvironmentEvidence {
  authOrigin: string;
  deployment: string;
  names: string[];
  schemaVersion: 1;
  secretChecks: {
    BETTER_AUTH_SECRET: { minimumLength: 32; satisfied: boolean };
  };
  target: EnvironmentTarget;
}

const ENVIRONMENT_KEY = /^[A-Z][A-Z0-9_]*$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateRequiredKeys(value: unknown, label: string) {
  if (!(isRecord(value) && Array.isArray(value.required))) {
    throw new Error(`Environment registry ${label} must define required keys`);
  }
  const { required } = value;
  if (required.some((key) => typeof key !== "string" || !ENVIRONMENT_KEY.test(key))) {
    throw new Error(`Environment registry ${label} has an invalid key`);
  }
  if (new Set(required).size !== required.length) {
    throw new Error(`Environment registry ${label} has duplicate keys`);
  }
}

export function validateEnvironmentRegistry(value: unknown): EnvironmentRegistry {
  if (!(isRecord(value) && value.schemaVersion === 2 && isRecord(value.targets))) {
    throw new Error("Environment registry must use schemaVersion 2 and define targets");
  }
  const targetNames = Object.keys(value.targets);
  if (
    targetNames.length !== ENVIRONMENT_TARGETS.length ||
    targetNames.some((target) => !ENVIRONMENT_TARGETS.includes(target as EnvironmentTarget))
  ) {
    throw new Error("Environment registry must define only preview and production targets");
  }

  for (const target of ENVIRONMENT_TARGETS) {
    const definition = value.targets[target];
    if (!(isRecord(definition) && isRecord(definition.scopes))) {
      throw new Error(`Environment registry target ${target} must define scoped variables`);
    }
    const scopeNames = Object.keys(definition.scopes);
    if (
      scopeNames.length !== ENVIRONMENT_SCOPES.length ||
      scopeNames.some((scope) => !ENVIRONMENT_SCOPES.includes(scope as EnvironmentScope))
    ) {
      throw new Error(`Environment registry target ${target} must define only reviewed scopes`);
    }
    for (const scope of ENVIRONMENT_SCOPES) {
      validateRequiredKeys(definition.scopes[scope], `target ${target}/${scope}`);
    }
  }

  return value as unknown as EnvironmentRegistry;
}

export function validateConvexRuntimeEnvironmentEvidence(
  value: unknown
): ConvexRuntimeEnvironmentEvidence {
  if (
    !(
      isRecord(value) &&
      value.schemaVersion === 1 &&
      ENVIRONMENT_TARGETS.includes(value.target as EnvironmentTarget) &&
      typeof value.deployment === "string" &&
      value.deployment.trim() &&
      typeof value.authOrigin === "string" &&
      Array.isArray(value.names) &&
      isRecord(value.secretChecks) &&
      isRecord(value.secretChecks.BETTER_AUTH_SECRET) &&
      value.secretChecks.BETTER_AUTH_SECRET.minimumLength === 32 &&
      typeof value.secretChecks.BETTER_AUTH_SECRET.satisfied === "boolean"
    )
  ) {
    throw new Error("Convex runtime evidence is malformed");
  }
  if (
    value.names.some((key) => typeof key !== "string" || !ENVIRONMENT_KEY.test(key)) ||
    new Set(value.names).size !== value.names.length
  ) {
    throw new Error("Convex runtime evidence contains invalid or duplicate names");
  }
  resolveAuthOrigin({ NEXT_PUBLIC_APP_URL: value.authOrigin, NODE_ENV: "production" });
  return value as unknown as ConvexRuntimeEnvironmentEvidence;
}

const URL_KEYS = new Set([
  "BETTER_AUTH_URL",
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_CONVEX_SITE_URL",
  "NEXT_PUBLIC_CONVEX_URL",
  "SITE_URL",
]);
const E2E_PROVISIONING_KEYS = [
  "E2E_PROVISIONING_TARGET",
  "E2E_SEED_SECRET",
  "E2E_STAFF_PASSWORD",
  "E2E_TARGET_ID",
  "E2E_TARGET_REVISION",
] as const;

const root = resolve(import.meta.dir, "../..");
const ENVIRONMENT_PREFLIGHT_CLI = {
  command: "bun run env:preflight --",
  description:
    "Validate one explicit hosted environment without printing values or contacting a deployment.",
  options: [
    { choices: ENVIRONMENT_TARGETS, name: "target", type: "string" },
    { name: "convex-env-evidence", type: "string" },
  ],
} as const;

export function readEnvironmentRegistry(
  readFile: (path: string, encoding: "utf8") => string = (path, encoding) =>
    readFileSync(path, encoding)
) {
  return validateEnvironmentRegistry(
    JSON.parse(readFile(resolve(root, "config/environment.registry.json"), "utf8"))
  );
}

export function readConvexRuntimeEnvironmentEvidence(
  path: string,
  readFile: (path: string, encoding: "utf8") => string = (filePath, encoding) =>
    readFileSync(filePath, encoding)
) {
  return validateConvexRuntimeEnvironmentEvidence(JSON.parse(readFile(resolve(path), "utf8")));
}

function originFor(value: string | undefined) {
  if (!value) {
    return null;
  }
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

const LOCAL_PREFLIGHT_SCOPES = ["browser", "nextServer", "ciDeploy"] as const;

function evaluateLocalEnvironmentScopes(
  env: Record<string, string | undefined>,
  target: EnvironmentTarget,
  registry: EnvironmentRegistry,
  errors: string[]
) {
  const missingByScope = Object.fromEntries(
    LOCAL_PREFLIGHT_SCOPES.map((scope) => [
      scope,
      registry.targets[target].scopes[scope].required.filter((key) => !env[key]?.trim()),
    ])
  ) as Record<(typeof LOCAL_PREFLIGHT_SCOPES)[number], string[]>;
  for (const scope of LOCAL_PREFLIGHT_SCOPES) {
    if (missingByScope[scope].length > 0) {
      errors.push(
        `Missing required ${target}/${scope} variables: ${missingByScope[scope].join(", ")}`
      );
    }
  }
  const required = LOCAL_PREFLIGHT_SCOPES.flatMap(
    (scope) => registry.targets[target].scopes[scope].required
  );
  for (const key of required.filter((entry) => URL_KEYS.has(entry))) {
    if (env[key]?.trim() && !originFor(env[key]?.trim())) {
      errors.push(`${key} must be an absolute HTTP(S) URL`);
    }
  }
  return {
    missing: LOCAL_PREFLIGHT_SCOPES.flatMap((scope) => missingByScope[scope]),
    missingByScope,
  };
}

function evaluateAuthOrigin(env: Record<string, string | undefined>, errors: string[]) {
  try {
    const authOrigin = resolveAuthOrigin(env);
    const aliasError = deprecatedPublicSiteUrlError(env, authOrigin);
    if (aliasError) {
      errors.push(aliasError);
    }
    return authOrigin;
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Authentication origin is invalid");
    return null;
  }
}

function evaluateConvexRuntimeEvidence(args: {
  authOrigin: string | null;
  env: Record<string, string | undefined>;
  errors: string[];
  evidence?: ConvexRuntimeEnvironmentEvidence;
  registry: EnvironmentRegistry;
  target: EnvironmentTarget;
}) {
  if (!args.evidence) {
    args.errors.push(
      `Missing target-explicit Convex runtime environment evidence for ${args.target}`
    );
    return;
  }
  let evidence: ConvexRuntimeEnvironmentEvidence;
  try {
    evidence = validateConvexRuntimeEnvironmentEvidence(args.evidence);
  } catch (error) {
    args.errors.push(error instanceof Error ? error.message : "Convex runtime evidence is invalid");
    return;
  }
  if (evidence.target !== args.target) {
    args.errors.push(`Convex runtime evidence target must equal ${args.target}`);
  }
  if (evidence.deployment !== args.env.CONVEX_DEPLOYMENT?.trim()) {
    args.errors.push("Convex runtime evidence deployment must match CONVEX_DEPLOYMENT exactly");
  }
  const runtimeNames = new Set(evidence.names);
  const missing = args.registry.targets[args.target].scopes.convexRuntime.required.filter(
    (key) => !runtimeNames.has(key)
  );
  if (missing.length > 0) {
    args.errors.push(
      `Missing required ${args.target}/convexRuntime variable names: ${missing.join(", ")}`
    );
  }
  if (!evidence.secretChecks.BETTER_AUTH_SECRET.satisfied) {
    args.errors.push(
      "BETTER_AUTH_SECRET must contain at least 32 characters in the selected runtime"
    );
  }
  if (args.authOrigin && evidence.authOrigin !== args.authOrigin) {
    args.errors.push(
      "Convex runtime authOrigin must match the browser and Next authentication origin"
    );
  }
  if (runtimeNames.has("GOOGLE_CLIENT_ID") !== runtimeNames.has("GOOGLE_CLIENT_SECRET")) {
    args.errors.push("Convex runtime Google credentials must configure both names or neither");
  }
  return evidence;
}

function evaluateE2eEnvironment(
  env: Record<string, string | undefined>,
  target: EnvironmentTarget,
  evidence: ConvexRuntimeEnvironmentEvidence | undefined,
  errors: string[]
) {
  const evidenceNames = new Set(evidence?.names);
  const configuredKeys = E2E_PROVISIONING_KEYS.filter(
    (key) => env[key]?.trim() || evidenceNames.has(key)
  );
  if (target === "production" && configuredKeys.length > 0) {
    errors.push("Production must not configure E2E provisioning variables");
  }
  if (
    target === "preview" &&
    configuredKeys.length > 0 &&
    env.E2E_PROVISIONING_TARGET?.trim() !== "preview"
  ) {
    errors.push("Preview E2E provisioning requires E2E_PROVISIONING_TARGET=preview");
  }
}

export function evaluateEnvironmentPreflight(
  env: Record<string, string | undefined>,
  target: EnvironmentTarget,
  registry = readEnvironmentRegistry(),
  convexRuntimeEvidence?: ConvexRuntimeEnvironmentEvidence
) {
  const validatedRegistry = validateEnvironmentRegistry(registry);
  if (!ENVIRONMENT_TARGETS.includes(target)) {
    throw new Error(`Unknown environment target: ${target}`);
  }
  const errors: string[] = [];
  const local = evaluateLocalEnvironmentScopes(env, target, validatedRegistry, errors);
  const authOrigin = evaluateAuthOrigin(env, errors);
  const validatedEvidence = evaluateConvexRuntimeEvidence({
    authOrigin,
    env,
    errors,
    evidence: convexRuntimeEvidence,
    registry: validatedRegistry,
    target,
  });
  evaluateE2eEnvironment(env, target, validatedEvidence, errors);

  return {
    errors,
    missing: local.missing,
    missingByScope: local.missingByScope,
    ok: errors.length === 0,
    target,
  };
}

function targetFromCli(
  value: boolean | string | undefined,
  env: Record<string, string | undefined>
) {
  const inferred = typeof value === "string" ? value : env.VERCEL_ENV;
  if (!ENVIRONMENT_TARGETS.includes(inferred as EnvironmentTarget)) {
    throw new Error(
      "Environment preflight requires --target preview|production when VERCEL_ENV is not explicit. Example: bun run env:preflight -- --target preview"
    );
  }
  return inferred as EnvironmentTarget;
}

if (import.meta.main) {
  try {
    const parsed = parseCliArguments(process.argv.slice(2), ENVIRONMENT_PREFLIGHT_CLI);
    if (parsed.help) {
      console.log(formatCliHelp(ENVIRONMENT_PREFLIGHT_CLI));
      process.exit(0);
    }
    const target = targetFromCli(parsed.values.target, process.env);
    const evidencePath = parsed.values["convex-env-evidence"];
    if (typeof evidencePath !== "string") {
      throw new Error(
        "Environment preflight requires --convex-env-evidence <names-only-json> for the selected target"
      );
    }
    const evidence = readConvexRuntimeEnvironmentEvidence(evidencePath);
    const result = evaluateEnvironmentPreflight(process.env, target, undefined, evidence);
    if (result.ok) {
      console.log(`Environment preflight passed for ${target}.`);
    } else {
      console.error(`Environment preflight failed for ${target}:`);
      for (const error of result.errors) {
        console.error(`- ${error}`);
      }
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Environment preflight failed");
    process.exitCode = 1;
  }
}
