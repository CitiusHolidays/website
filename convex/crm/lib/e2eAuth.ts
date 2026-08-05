import { ConvexError } from "convex/values";

export function assertE2eSecret(secret?: string, expected = process.env.E2E_SEED_SECRET) {
  if (!expected || (secret !== undefined && secret !== expected)) {
    throw new ConvexError("Invalid E2E seed secret");
  }
  return expected;
}

export function assertProvidedE2eSecret(
  secret: string | null | undefined,
  expected = process.env.E2E_SEED_SECRET
) {
  if (!secret || !expected || secret !== expected) {
    throw new ConvexError("Invalid E2E seed secret");
  }
  return expected;
}
