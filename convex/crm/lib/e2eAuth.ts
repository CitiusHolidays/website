import { ConvexError } from "convex/values";

interface E2eProvisioningEnvironment {
  E2E_PROVISIONING_TARGET?: string;
  E2E_SEED_SECRET?: string;
  E2E_TARGET_ID?: string;
  E2E_TARGET_REVISION?: string;
  VERCEL_ENV?: string;
}

const ALLOWED_E2E_PROVISIONING_TARGETS = new Set(["development", "preview"]);
const DEVELOPMENT_TARGET_ID_PATTERN = /^development-[A-Za-z0-9._:+-]+$/;
const PREVIEW_TARGET_ID_PATTERN = /^preview-[A-Za-z0-9._:+-]+$/;
const E2E_REVISION_PATTERN = /^[a-f0-9]{40}$/;

function currentE2eProvisioningEnvironment(): E2eProvisioningEnvironment {
  return {
    E2E_PROVISIONING_TARGET: process.env.E2E_PROVISIONING_TARGET,
    E2E_SEED_SECRET: process.env.E2E_SEED_SECRET,
    E2E_TARGET_ID: process.env.E2E_TARGET_ID,
    E2E_TARGET_REVISION: process.env.E2E_TARGET_REVISION,
    VERCEL_ENV: process.env.VERCEL_ENV,
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
  const target = environment.E2E_PROVISIONING_TARGET as "development" | "preview";
  const expected = environment.E2E_TARGET_ID?.trim();
  const revision = environment.E2E_TARGET_REVISION?.trim();
  const pattern =
    target === "development" ? DEVELOPMENT_TARGET_ID_PATTERN : PREVIEW_TARGET_ID_PATTERN;
  if (
    !(
      targetId &&
      expected &&
      targetId === expected &&
      pattern.test(targetId) &&
      revision &&
      E2E_REVISION_PATTERN.test(revision)
    )
  ) {
    throw new ConvexError("E2E target identity is not authorized");
  }
  return { revision, target, targetId };
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
