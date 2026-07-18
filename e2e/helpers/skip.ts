export function hasE2eCredentials() {
  return Boolean(process.env.E2E_STAFF_PASSWORD);
}

export function e2eStrictMode() {
  return process.env.E2E_STRICT === "1";
}

export const E2E_SKIP_REASON =
  "Set E2E_STAFF_PASSWORD and run convex e2e seed before interaction specs.";
