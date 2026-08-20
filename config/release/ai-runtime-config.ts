import { readFileSync } from "node:fs";
import { resolve } from "node:path";

interface AiRuntimeManifest {
  browser: string[];
  convexRuntime: string[];
  nextServer: string[];
}

const NEXT_SERVER_KEYS = ["AI_RATE_LIMIT_SALT", "AI_RUNTIME_SECRET", "OPENROUTER_API_KEY"];
const CONVEX_RUNTIME_KEYS = ["AI_RUNTIME_SECRET"];
const SERVER_ONLY_KEYS = new Set([...NEXT_SERVER_KEYS, ...CONVEX_RUNTIME_KEYS]);

export function evaluateAiRuntimeEnvironment(env: Record<string, string | undefined>) {
  const target = env.VERCEL_ENV?.trim();
  if (target !== "preview" && target !== "production") {
    return { errors: [], ok: true };
  }

  const errors = NEXT_SERVER_KEYS.filter((key) => !env[key]?.trim()).map(
    (key) => `${key} is missing from the ${target} Next.js runtime`
  );
  return { errors, ok: errors.length === 0 };
}

export function evaluateAiRuntimeManifest(manifest: AiRuntimeManifest) {
  const errors: string[] = [];
  const browser = new Set(manifest.browser);
  const convexRuntime = new Set(manifest.convexRuntime);
  const nextServer = new Set(manifest.nextServer);

  for (const key of NEXT_SERVER_KEYS) {
    if (!nextServer.has(key)) {
      errors.push(`${key} must be assigned to the Next.js server runtime group`);
    }
  }
  for (const key of CONVEX_RUNTIME_KEYS) {
    if (!convexRuntime.has(key)) {
      errors.push(`${key} must be assigned to the Convex runtime group`);
    }
  }
  for (const key of SERVER_ONLY_KEYS) {
    if (browser.has(key)) {
      errors.push(`${key} must not be assigned to the browser runtime group`);
    }
  }

  return { errors, ok: errors.length === 0 };
}

if (import.meta.main) {
  const manifestPath = resolve(import.meta.dir, "../environment.manifest.json");
  // SAFETY: validateAiRuntimeManifest checks every consumed manifest field immediately after parsing.
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as AiRuntimeManifest;
  const manifestResult = evaluateAiRuntimeManifest(manifest);
  const environmentResult = evaluateAiRuntimeEnvironment(process.env);
  const errors = [...manifestResult.errors, ...environmentResult.errors];
  if (errors.length === 0) {
    console.log(
      "AI runtime configuration preflight passed: required keys are assigned to server-only runtime groups and hosted Next.js values are present."
    );
  } else {
    console.error("AI runtime configuration preflight failed:");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
  }
}
