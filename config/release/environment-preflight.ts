import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { formatCliHelp, parseCliArguments } from "../commands/cli";

export const ENVIRONMENT_TARGETS = ["preview", "production"] as const;
export type EnvironmentTarget = (typeof ENVIRONMENT_TARGETS)[number];

interface EnvironmentRegistry {
  schemaVersion: number;
  targets: Record<EnvironmentTarget, { required: string[] }>;
}

const ENVIRONMENT_KEY = /^[A-Z][A-Z0-9_]*$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateEnvironmentRegistry(value: unknown): EnvironmentRegistry {
  if (!(isRecord(value) && value.schemaVersion === 1 && isRecord(value.targets))) {
    throw new Error("Environment registry must use schemaVersion 1 and define targets");
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
    if (!(isRecord(definition) && Array.isArray(definition.required))) {
      throw new Error(`Environment registry target ${target} must define required variables`);
    }
    const { required } = definition;
    if (required.length === 0) {
      throw new Error(`Environment registry target ${target} must require at least one variable`);
    }
    if (required.some((key) => typeof key !== "string" || !ENVIRONMENT_KEY.test(key))) {
      throw new Error(`Environment registry target ${target} contains an invalid variable name`);
    }
    if (new Set(required).size !== required.length) {
      throw new Error(`Environment registry target ${target} contains duplicate variables`);
    }
  }

  return value as unknown as EnvironmentRegistry;
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
] as const;

const root = resolve(import.meta.dir, "../..");
const ENVIRONMENT_PREFLIGHT_CLI = {
  command: "bun run env:preflight --",
  description:
    "Validate one explicit hosted environment without printing values or contacting a deployment.",
  options: [{ choices: ENVIRONMENT_TARGETS, name: "target", type: "string" }],
} as const;

export function readEnvironmentRegistry(
  readFile: (path: string, encoding: "utf8") => string = (path, encoding) =>
    readFileSync(path, encoding)
) {
  return validateEnvironmentRegistry(
    JSON.parse(readFile(resolve(root, "config/environment.registry.json"), "utf8"))
  );
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

export function evaluateEnvironmentPreflight(
  env: Record<string, string | undefined>,
  target: EnvironmentTarget,
  registry = readEnvironmentRegistry()
) {
  const validatedRegistry = validateEnvironmentRegistry(registry);
  if (!ENVIRONMENT_TARGETS.includes(target)) {
    throw new Error(`Unknown environment target: ${target}`);
  }
  const { required } = validatedRegistry.targets[target];
  const errors: string[] = [];
  const missing = required.filter((key) => !env[key]?.trim());
  if (missing.length > 0) {
    errors.push(`Missing required ${target} variables: ${missing.join(", ")}`);
  }

  for (const key of required.filter((entry) => URL_KEYS.has(entry))) {
    if (env[key]?.trim() && !originFor(env[key]?.trim())) {
      errors.push(`${key} must be an absolute HTTP(S) URL`);
    }
  }

  const authOrigin = originFor(
    env.BETTER_AUTH_URL?.trim() || env.SITE_URL?.trim() || env.NEXT_PUBLIC_APP_URL?.trim()
  );
  for (const key of ["SITE_URL", "NEXT_PUBLIC_APP_URL", "BETTER_AUTH_URL"]) {
    const value = env[key]?.trim();
    if (value && authOrigin && originFor(value) !== authOrigin) {
      errors.push(`${key} must resolve to the same origin as the authentication origin`);
    }
  }

  const configuredE2eKeys = E2E_PROVISIONING_KEYS.filter((key) => env[key]?.trim());
  if (target === "production" && configuredE2eKeys.length > 0) {
    errors.push("Production must not configure E2E provisioning variables");
  }
  if (
    target === "preview" &&
    configuredE2eKeys.length > 0 &&
    env.E2E_PROVISIONING_TARGET?.trim() !== "preview"
  ) {
    errors.push("Preview E2E provisioning requires E2E_PROVISIONING_TARGET=preview");
  }

  return {
    errors,
    missing,
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
    const result = evaluateEnvironmentPreflight(process.env, target);
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
