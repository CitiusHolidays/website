import type { RuntimeValue } from "./runtimeValues";
import { isRuntimeNumber, isRuntimeString } from "./runtimeValues";

interface TimestampSource {
  createdAt?: RuntimeValue;
  updatedAt?: RuntimeValue;
}

function stableIsoTimestamp<Value>(value: Value): string | null {
  if (!(isRuntimeString(value) || isRuntimeNumber(value))) {
    return null;
  }
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

export function stableProfileTimestamps(
  profile: TimestampSource | null,
  identity: TimestampSource
) {
  if (profile) {
    const createdAt = stableIsoTimestamp(profile.createdAt);
    return {
      createdAt,
      updatedAt: stableIsoTimestamp(profile.updatedAt) ?? createdAt,
    };
  }

  const identityCreatedAt = stableIsoTimestamp(identity.createdAt);
  const identityUpdatedAt = stableIsoTimestamp(identity.updatedAt);
  return {
    createdAt: identityCreatedAt,
    updatedAt: identityUpdatedAt ?? identityCreatedAt,
  };
}
