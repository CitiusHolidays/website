const DEV_DEPLOYMENT_KEY_PATTERN = /^dev:[^|\s]+\|\S+$/;

export function evaluateConvexCiCredential(value: string | undefined) {
  const credential = value?.trim() ?? "";
  if (!credential) {
    return {
      error: "Required non-production Convex CI credential is not configured",
      ok: false,
    } as const;
  }
  if (!DEV_DEPLOYMENT_KEY_PATTERN.test(credential)) {
    return {
      error: "Convex CI credential must be a deployment-scoped dev key",
      ok: false,
    } as const;
  }
  return { error: null, ok: true } as const;
}

if (import.meta.main) {
  const result = evaluateConvexCiCredential(process.env.CONVEX_DEPLOY_KEY);
  if (result.ok) {
    console.log("Non-production Convex CI credential policy passed.");
  } else {
    console.error(result.error);
    process.exitCode = 1;
  }
}
