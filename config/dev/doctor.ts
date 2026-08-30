import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { formatCliHelp, parseCliArguments } from "../commands/cli";

export const LOCAL_DEVELOPMENT_PROFILES = ["public", "portal", "studio", "full"] as const;
export type LocalDevelopmentProfile = (typeof LOCAL_DEVELOPMENT_PROFILES)[number];

export const LOCAL_PROFILE_COMMANDS = {
  full: "bun run dev:all; in another terminal, bun run --cwd citius-blog dev",
  portal: "bun run dev:all",
  public: "bun run dev",
  studio: "bun run --cwd citius-blog dev",
} satisfies Record<LocalDevelopmentProfile, string>;

export const SUPPORTED_BUN_VERSION = "1.4.0";
export const SUPPORTED_NODE_RANGE = ">=22.12 <27";
const LEADING_V = /^v/;
const SEMVER_PREFIX = /^(\d+)\.(\d+)\.(\d+)/;

interface DoctorFiles {
  bunLock: boolean;
  generatedConvex: boolean;
  nodeModules: boolean;
  studioLock: boolean;
}

interface DoctorVersions {
  bun: string;
  node: string;
}

interface EvaluateDoctorOptions {
  env: Record<string, string | undefined>;
  files: DoctorFiles;
  profile: LocalDevelopmentProfile;
  versions: DoctorVersions;
}

interface DoctorDeployment {
  classification: "development" | "missing" | "unsafe";
  name?: string;
}

export interface LocalDoctorResult {
  deployment: DoctorDeployment;
  errors: string[];
  ok: boolean;
  profile: LocalDevelopmentProfile;
}

const PORTAL_KEYS = [
  "BETTER_AUTH_URL",
  "CONVEX_DEPLOYMENT",
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_CONVEX_SITE_URL",
  "NEXT_PUBLIC_CONVEX_URL",
  "SITE_URL",
] as const;

const URL_KEYS = [
  "BETTER_AUTH_URL",
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_CONVEX_SITE_URL",
  "NEXT_PUBLIC_CONVEX_URL",
  "SITE_URL",
] as const;

const E2E_KEYS = [
  "E2E_PROVISIONING_TARGET",
  "E2E_SEED_SECRET",
  "E2E_STAFF_PASSWORD",
  "E2E_TARGET_ID",
] as const;

function versionParts(version: string) {
  const match = version.replace(LEADING_V, "").match(SEMVER_PREFIX);
  return match ? match.slice(1).map(Number) : null;
}

function compareVersion(left: string, right: string) {
  const leftParts = versionParts(left);
  const rightParts = versionParts(right);
  if (!(leftParts && rightParts)) {
    return null;
  }
  for (let index = 0; index < leftParts.length; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) {
      return difference;
    }
  }
  return 0;
}

function isSupportedBun(version: string) {
  return compareVersion(version, SUPPORTED_BUN_VERSION) === 0;
}

function isSupportedNode(version: string) {
  const minimum = compareVersion(version, "22.12.0");
  const maximum = compareVersion(version, "27.0.0");
  return minimum !== null && maximum !== null && minimum >= 0 && maximum < 0;
}

function urlOrigin(value: string | undefined) {
  if (!value?.trim()) {
    return null;
  }
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.origin : null;
  } catch {
    return null;
  }
}

function deploymentFrom(value: string | undefined): DoctorDeployment {
  const trimmed = value?.trim();
  if (!trimmed) {
    return { classification: "missing" };
  }
  if (!trimmed.startsWith("dev:")) {
    return { classification: "unsafe" };
  }
  return { classification: "development", name: trimmed.slice("dev:".length) };
}

function collectRuntimeErrors({
  errors,
  files,
  needsStudio,
  versions,
}: {
  errors: string[];
  files: DoctorFiles;
  needsStudio: boolean;
  versions: DoctorVersions;
}) {
  if (!isSupportedBun(versions.bun)) {
    errors.push(
      `Supported Bun version is ${SUPPORTED_BUN_VERSION}; switch runtimes before install/start`
    );
  }
  if (!isSupportedNode(versions.node)) {
    errors.push(
      `Supported Node range is ${SUPPORTED_NODE_RANGE}; switch runtimes before install/start`
    );
  }
  if (!files.bunLock) {
    errors.push("bun.lock is missing; restore the reviewed lockfile before install/start");
  }
  if (!files.nodeModules) {
    errors.push("node_modules is missing; run bun install --frozen-lockfile");
  }
  if (needsStudio && !files.studioLock) {
    errors.push("citius-blog/bun.lock is missing; restore the Studio lockfile");
  }
}

function collectPortalErrors({
  deployment,
  env,
  errors,
  files,
  profile,
}: {
  deployment: DoctorDeployment;
  env: Record<string, string | undefined>;
  errors: string[];
  files: DoctorFiles;
  profile: LocalDevelopmentProfile;
}) {
  const missing = PORTAL_KEYS.filter((key) => !env[key]?.trim());
  if (missing.length > 0) {
    errors.push(`Missing ${profile} variable names: ${missing.join(", ")}`);
  }
  for (const key of URL_KEYS) {
    if (env[key]?.trim() && !urlOrigin(env[key])) {
      errors.push(`${key} must be an absolute HTTP(S) URL`);
    }
  }
  const authOrigins = ["BETTER_AUTH_URL", "NEXT_PUBLIC_APP_URL", "SITE_URL"]
    .map((key) => urlOrigin(env[key]))
    .filter((origin): origin is string => Boolean(origin));
  if (new Set(authOrigins).size > 1) {
    errors.push("BETTER_AUTH_URL, NEXT_PUBLIC_APP_URL, and SITE_URL must share one origin");
  }
  if (deployment.classification === "unsafe") {
    errors.push(
      "Production-class Convex deployments are not allowed in local development profiles"
    );
  }
  if (!files.generatedConvex) {
    errors.push("convex/_generated is missing; use the explicit non-production Convex workflow");
  }
}

function collectLocalSafetyErrors(env: Record<string, string | undefined>, errors: string[]) {
  if (env.CONVEX_DEPLOY_KEY?.trim() || env.VERCEL_ENV === "production") {
    errors.push(
      "Deployment credentials or Production platform state are not allowed in local profiles"
    );
  }
  const populatedE2EKeys = E2E_KEYS.filter((key) => env[key]?.trim());
  if (populatedE2EKeys.length > 0) {
    errors.push(
      `E2E provisioning variable names require the separate target-approved workflow: ${populatedE2EKeys.join(", ")}`
    );
  }
}

export function evaluateLocalDoctor({
  env,
  files,
  profile,
  versions,
}: EvaluateDoctorOptions): LocalDoctorResult {
  const errors: string[] = [];
  const needsPortal = profile === "portal" || profile === "full";
  const needsStudio = profile === "studio" || profile === "full";
  const deployment = deploymentFrom(env.CONVEX_DEPLOYMENT);

  collectRuntimeErrors({ errors, files, needsStudio, versions });

  if (needsPortal) {
    collectPortalErrors({ deployment, env, errors, files, profile });
  }

  collectLocalSafetyErrors(env, errors);

  return { deployment, errors, ok: errors.length === 0, profile };
}

export function formatDoctorResult(result: LocalDoctorResult) {
  const lines = [`Local development doctor (${result.profile})`];
  if (result.deployment.classification === "development") {
    lines.push(`Convex target: development:${result.deployment.name}`);
  } else if (result.profile === "portal" || result.profile === "full") {
    lines.push(`Convex target: ${result.deployment.classification}`);
  }
  if (result.ok) {
    lines.push(`Ready. Next command: ${LOCAL_PROFILE_COMMANDS[result.profile]}`);
  } else {
    lines.push("Not ready; no server was started.");
    for (const error of result.errors) {
      lines.push(`- ${error}`);
    }
    lines.push(
      `Fix the listed names, then retry: bun run dev:doctor -- --profile ${result.profile}`
    );
  }
  return lines.join("\n");
}

const LOCAL_DOCTOR_CLI = {
  command: "bun run dev:doctor --",
  description:
    "Check local files, runtime versions, key names, URL shape, and non-production target identity. Performs no network or deployment action.",
  options: [
    {
      choices: LOCAL_DEVELOPMENT_PROFILES,
      description: "Local surface to validate (defaults to public)",
      name: "profile",
      type: "string" as const,
    },
  ],
};

if (import.meta.main) {
  try {
    const parsed = parseCliArguments(process.argv.slice(2), LOCAL_DOCTOR_CLI);
    if (parsed.help) {
      console.log(formatCliHelp(LOCAL_DOCTOR_CLI));
    } else {
      const requestedProfile = parsed.values.profile ?? "public";
      const profile = LOCAL_DEVELOPMENT_PROFILES.find(
        (candidate) => candidate === requestedProfile
      );
      if (!profile) {
        throw new Error(`Unknown local development profile: ${requestedProfile}`);
      }
      const root = resolve(import.meta.dir, "../..");
      const result = evaluateLocalDoctor({
        env: process.env,
        files: {
          bunLock: existsSync(resolve(root, "bun.lock")),
          generatedConvex: existsSync(resolve(root, "convex/_generated/api.d.ts")),
          nodeModules: existsSync(resolve(root, "node_modules")),
          studioLock: existsSync(resolve(root, "citius-blog/bun.lock")),
        },
        profile,
        versions: { bun: process.versions.bun ?? "", node: process.version },
      });
      console.log(formatDoctorResult(result));
      if (!result.ok) {
        process.exitCode = 1;
      }
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Local development doctor failed");
    process.exitCode = 1;
  }
}
