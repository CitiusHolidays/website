import { ConvexError } from "convex/values";
import { env } from "../../_generated/server";

export interface OperationalTargetIdentity {
  targetDeployment: string;
  targetEnvironment: "development" | "preview" | "production";
  targetRevision: string;
}

function configuredValue(value: string | undefined) {
  const configured = value?.trim();
  return configured && configured.length > 0 ? configured : null;
}

export function operationalTargetIdentity(): OperationalTargetIdentity {
  const targetDeployment = configuredValue(env.OPERATIONAL_CONTROL_TARGET_ID);
  const targetEnvironment = configuredValue(env.VERCEL_ENV);
  const targetRevision = configuredValue(env.OPERATIONAL_CONTROL_SOURCE_REVISION);
  if (!(targetDeployment && targetRevision && targetEnvironment)) {
    throw new ConvexError("OPERATIONAL_CONTROL_TARGET_IDENTITY_UNAVAILABLE");
  }
  if (!["development", "preview", "production"].includes(targetEnvironment)) {
    throw new ConvexError("OPERATIONAL_CONTROL_TARGET_IDENTITY_UNAVAILABLE");
  }
  let normalizedEnvironment: OperationalTargetIdentity["targetEnvironment"] = "development";
  if (targetEnvironment === "preview") {
    normalizedEnvironment = "preview";
  } else if (targetEnvironment === "production") {
    normalizedEnvironment = "production";
  }
  return {
    targetDeployment,
    targetEnvironment: normalizedEnvironment,
    targetRevision,
  };
}

export function assertOperationalTargetIdentity(
  expected: {
    expectedTargetDeployment: string;
    expectedTargetEnvironment: string;
    expectedTargetRevision: string;
  },
  actual = operationalTargetIdentity()
) {
  if (
    expected.expectedTargetDeployment !== actual.targetDeployment ||
    expected.expectedTargetEnvironment !== actual.targetEnvironment ||
    expected.expectedTargetRevision !== actual.targetRevision
  ) {
    throw new ConvexError("OPERATIONAL_CONTROL_TARGET_MISMATCH");
  }
  return actual;
}
