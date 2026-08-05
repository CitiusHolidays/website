import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const ENVIRONMENT_TARGETS = ["preview", "production"] as const;
export type EnvironmentTarget = (typeof ENVIRONMENT_TARGETS)[number];

interface EnvironmentRegistry {
  schemaVersion: number;
  targets: Record<EnvironmentTarget, { required: string[] }>;
}

const URL_KEYS = new Set([
  "BETTER_AUTH_URL",
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_CONVEX_SITE_URL",
  "NEXT_PUBLIC_CONVEX_URL",
  "SITE_URL",
]);

const root = resolve(import.meta.dir, "../..");

export function readEnvironmentRegistry(
  readFile: (path: string, encoding: "utf8") => string = (path, encoding) =>
    readFileSync(path, encoding)
) {
  return JSON.parse(
    readFile(resolve(root, "config/environment.registry.json"), "utf8")
  ) as EnvironmentRegistry;
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
  const required = registry.targets[target]?.required ?? [];
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

  return {
    errors,
    missing,
    ok: errors.length === 0,
    target,
  };
}

function targetFromArgs(args: string[], env: Record<string, string | undefined>) {
  const flagIndex = args.indexOf("--target");
  const explicit = flagIndex >= 0 ? args[flagIndex + 1] : undefined;
  const inferred = explicit || (env.VERCEL_ENV === "production" ? "production" : "preview");
  if (!ENVIRONMENT_TARGETS.includes(inferred as EnvironmentTarget)) {
    throw new Error(`Unknown environment target: ${inferred}`);
  }
  return inferred as EnvironmentTarget;
}

if (import.meta.main) {
  try {
    const target = targetFromArgs(process.argv.slice(2), process.env);
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
