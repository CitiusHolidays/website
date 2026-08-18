import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { deprecatedPublicSiteUrlError, resolveAuthOrigin } from "../../convex/lib/authOriginPolicy";
import { isRuntimeBoolean, isRuntimeObject, isRuntimeString } from "../../src/lib/runtimeValues";
import { formatCliHelp, parseCliArguments } from "../commands/cli";
import type { JsonObject, JsonValue } from "../lib/jsonValue";

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

function isRecord(value: JsonValue): value is JsonObject {
  return isRuntimeObject(value) && value !== null && !Array.isArray(value);
}

function validateRequiredKeys(value: JsonValue, label: string): string[] {
  if (!(isRecord(value) && Array.isArray(value.required))) {
    throw new Error(`Environment registry ${label} must define required keys`);
  }
  const { required } = value;
  if (required.some((key) => !(isRuntimeString(key) && ENVIRONMENT_KEY.test(key)))) {
    throw new Error(`Environment registry ${label} has an invalid key`);
  }
  if (new Set(required).size !== required.length) {
    throw new Error(`Environment registry ${label} has duplicate keys`);
  }
  return required;
}

export function validateEnvironmentRegistry(value: JsonValue): EnvironmentRegistry {
  if (!(isRecord(value) && value.schemaVersion === 2 && isRecord(value.targets))) {
    throw new Error("Environment registry must use schemaVersion 2 and define targets");
  }
  const targetNames = Object.keys(value.targets);
  if (
    targetNames.length !== ENVIRONMENT_TARGETS.length ||
    targetNames.some((target) => !ENVIRONMENT_TARGETS.some((candidate) => candidate === target))
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
      scopeNames.some((scope) => !ENVIRONMENT_SCOPES.some((candidate) => candidate === scope))
    ) {
      throw new Error(`Environment registry target ${target} must define only reviewed scopes`);
    }
    for (const scope of ENVIRONMENT_SCOPES) {
      validateRequiredKeys(definition.scopes[scope], `target ${target}/${scope}`);
    }
  }

  return {
    schemaVersion: 2,
    targets: {
      preview: {
        scopes: {
          browser: {
            required: validateRequiredKeys(
              value.targets.preview.scopes.browser,
              "target preview/browser"
            ),
          },
          ciDeploy: {
            required: validateRequiredKeys(
              value.targets.preview.scopes.ciDeploy,
              "target preview/ciDeploy"
            ),
          },
          convexRuntime: {
            required: validateRequiredKeys(
              value.targets.preview.scopes.convexRuntime,
              "target preview/convexRuntime"
            ),
          },
          nextServer: {
            required: validateRequiredKeys(
              value.targets.preview.scopes.nextServer,
              "target preview/nextServer"
            ),
          },
        },
      },
      production: {
        scopes: {
          browser: {
            required: validateRequiredKeys(
              value.targets.production.scopes.browser,
              "target production/browser"
            ),
          },
          ciDeploy: {
            required: validateRequiredKeys(
              value.targets.production.scopes.ciDeploy,
              "target production/ciDeploy"
            ),
          },
          convexRuntime: {
            required: validateRequiredKeys(
              value.targets.production.scopes.convexRuntime,
              "target production/convexRuntime"
            ),
          },
          nextServer: {
            required: validateRequiredKeys(
              value.targets.production.scopes.nextServer,
              "target production/nextServer"
            ),
          },
        },
      },
    },
  };
}

export function validateConvexRuntimeEnvironmentEvidence(
  value: JsonValue
): ConvexRuntimeEnvironmentEvidence {
  if (
    !(
      isRecord(value) &&
      value.schemaVersion === 1 &&
      (value.target === "preview" || value.target === "production") &&
      isRuntimeString(value.deployment) &&
      value.deployment.trim() &&
      isRuntimeString(value.authOrigin) &&
      Array.isArray(value.names) &&
      isRecord(value.secretChecks) &&
      isRecord(value.secretChecks.BETTER_AUTH_SECRET) &&
      value.secretChecks.BETTER_AUTH_SECRET.minimumLength === 32 &&
      isRuntimeBoolean(value.secretChecks.BETTER_AUTH_SECRET.satisfied)
    )
  ) {
    throw new Error("Convex runtime evidence is malformed");
  }
  const names: string[] = [];
  for (const name of value.names) {
    if (!isRuntimeString(name)) {
      throw new Error("Convex runtime evidence contains a non-string environment name");
    }
    names.push(name);
  }
  if (names.some((key) => !ENVIRONMENT_KEY.test(key)) || new Set(names).size !== names.length) {
    throw new Error("Convex runtime evidence contains invalid or duplicate names");
  }
  resolveAuthOrigin({ NEXT_PUBLIC_APP_URL: value.authOrigin, NODE_ENV: "production" });
  return {
    authOrigin: value.authOrigin,
    deployment: value.deployment,
    names,
    schemaVersion: 1,
    secretChecks: {
      BETTER_AUTH_SECRET: {
        minimumLength: 32,
        satisfied: value.secretChecks.BETTER_AUTH_SECRET.satisfied,
      },
    },
    target: value.target,
  };
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
  // SAFETY: LOCAL_PREFLIGHT_SCOPES is the complete key source, and every mapped value is a string array.
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
  const inferred = isRuntimeString(value) ? value : env.VERCEL_ENV;
  const target = ENVIRONMENT_TARGETS.find((candidate) => candidate === inferred);
  if (!target) {
    throw new Error(
      "Environment preflight requires --target preview|production when VERCEL_ENV is not explicit. Example: bun run env:preflight -- --target preview"
    );
  }
  return target;
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
    if (!isRuntimeString(evidencePath)) {
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
