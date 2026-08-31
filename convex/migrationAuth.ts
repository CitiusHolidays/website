import { ConvexError, v } from "convex/values";
import { env } from "./_generated/server";
import {
  assertOperationalTargetIdentity,
  type OperationalTargetIdentity,
} from "./crm/lib/operationalTargetIdentity";

export const migrationTargetArgs = {
  expectedTargetDeployment: v.string(),
  expectedTargetEnvironment: v.string(),
  expectedTargetRevision: v.string(),
};

export const migrationTargetResultFields = {
  targetDeployment: v.string(),
  targetEnvironment: v.union(
    v.literal("development"),
    v.literal("preview"),
    v.literal("production")
  ),
  targetRevision: v.string(),
};

export const targetBoundMigrationArgs = {
  ...migrationTargetArgs,
  secret: v.string(),
};

export function assertMigrationSecret(secret: string) {
  const expected = env.MIGRATION_SECRET;
  if (!expected || secret !== expected) {
    throw new ConvexError("Invalid migration secret");
  }
}

export function assertMigrationTarget(args: {
  expectedTargetDeployment: string;
  expectedTargetEnvironment: string;
  expectedTargetRevision: string;
}) {
  return assertOperationalTargetIdentity(args);
}

export function assertTargetBoundMigration(
  args: Parameters<typeof assertMigrationTarget>[0] & {
    secret: string;
  }
) {
  assertMigrationSecret(args.secret);
  return assertMigrationTarget(args);
}

export function targetBoundMigrationRegistryKey(
  baseKey: string,
  target: OperationalTargetIdentity
) {
  return `${baseKey}:target:${migrationTargetFingerprint(target)}`;
}

export function migrationTargetFingerprint(target: OperationalTargetIdentity) {
  return JSON.stringify([target.targetDeployment, target.targetEnvironment, target.targetRevision]);
}
