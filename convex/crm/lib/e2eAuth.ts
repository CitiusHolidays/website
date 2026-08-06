import { ConvexError } from "convex/values";

interface E2eProvisioningEnvironment {
  E2E_PROVISIONING_TARGET?: string;
  E2E_SEED_SECRET?: string;
  VERCEL_ENV?: string;
}

const ALLOWED_E2E_PROVISIONING_TARGETS = new Set(["development", "preview"]);

function currentE2eProvisioningEnvironment(): E2eProvisioningEnvironment {
  return {
    E2E_PROVISIONING_TARGET: process.env.E2E_PROVISIONING_TARGET,
    E2E_SEED_SECRET: process.env.E2E_SEED_SECRET,
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
