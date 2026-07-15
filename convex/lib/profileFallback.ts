type TimestampSource = {
  createdAt?: unknown;
  updatedAt?: unknown;
};

function stableIsoTimestamp(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") {
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
