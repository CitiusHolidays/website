import { ConvexError } from "convex/values";
import { env } from "../../_generated/server";

interface E2eProvisioningEnvironment {
  E2E_PROVISIONING_TARGET?: string;
  E2E_SEED_SECRET?: string;
  E2E_TARGET_ID?: string;
  VERCEL_ENV?: string;
}

const ALLOWED_E2E_PROVISIONING_TARGETS = new Set(["development", "preview"]);
const DEVELOPMENT_TARGET_ID_PATTERN = /^development-[A-Za-z0-9._:+-]+$/;
const PREVIEW_TARGET_ID_PATTERN = /^preview-[A-Za-z0-9._:+-]+$/;

function currentE2eProvisioningEnvironment(): E2eProvisioningEnvironment {
  return {
    E2E_PROVISIONING_TARGET: env.E2E_PROVISIONING_TARGET,
    E2E_SEED_SECRET: env.E2E_SEED_SECRET,
    E2E_TARGET_ID: env.E2E_TARGET_ID,
    VERCEL_ENV: env.VERCEL_ENV,
  };
}

function assertE2eProvisioningEnvironment(environment: E2eProvisioningEnvironment) {
  const target = environment.E2E_PROVISIONING_TARGET?.trim();
  const platformTarget = environment.VERCEL_ENV?.trim();
  if (platformTarget === "production" || !target || !ALLOWED_E2E_PROVISIONING_TARGETS.has(target)) {
    throw new ConvexError("E2E provisioning is not authorized");
  }
}

export function assertE2eSecret(
  secret?: string,
  environment: E2eProvisioningEnvironment = currentE2eProvisioningEnvironment()
) {
  assertE2eProvisioningEnvironment(environment);
  const expected = environment.E2E_SEED_SECRET;
  if (!expected || (secret !== undefined && secret !== expected)) {
    throw new ConvexError("Invalid E2E seed secret");
  }
  return expected;
}

export function assertE2eTargetIdentity(
  targetId: string | null | undefined,
  environment: E2eProvisioningEnvironment = currentE2eProvisioningEnvironment()
) {
  assertE2eProvisioningEnvironment(environment);
  // SAFETY: assertE2eProvisioningEnvironment restricts this value to development or preview.
  const target = environment.E2E_PROVISIONING_TARGET as "development" | "preview";
  const expected = environment.E2E_TARGET_ID?.trim();
  const pattern =
    target === "development" ? DEVELOPMENT_TARGET_ID_PATTERN : PREVIEW_TARGET_ID_PATTERN;
  if (!(targetId && expected && targetId === expected && pattern.test(targetId))) {
    throw new ConvexError("E2E target identity is not authorized");
  }
  return { target, targetId };
}

export function assertProvidedE2eSecret(
  secret: string | null | undefined,
  environment: E2eProvisioningEnvironment = currentE2eProvisioningEnvironment()
) {
  assertE2eProvisioningEnvironment(environment);
  const expected = environment.E2E_SEED_SECRET;
  if (!secret || secret !== expected) {
    throw new ConvexError("Invalid E2E seed secret");
  }
  return secret;
}
