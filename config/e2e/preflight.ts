export type E2eProvisioningTarget = "development" | "preview";

export interface E2ePreflightResult {
  mode: "optional-skip" | "ready";
  target: E2eProvisioningTarget | null;
}

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "::1", "localhost"]);

function parseUrl(value: string | undefined, key: string) {
  if (!value) {
    throw new Error(`${key} is required for authenticated E2E provisioning.`);
  }
  try {
    const parsed = new URL(value);
    if (!(parsed.protocol === "http:" || parsed.protocol === "https:")) {
      throw new Error("unsupported protocol");
    }
    return parsed;
  } catch (error) {
    throw new Error(`${key} must be an absolute HTTP(S) URL.`, { cause: error });
  }
}

export function validateE2ePreflight(
  env: Record<string, string | undefined>,
  baseUrl: string,
  strict: boolean
): E2ePreflightResult {
  if (!(env.E2E_STAFF_PASSWORD || strict)) {
    return { mode: "optional-skip", target: null };
  }

  const missing = [
    "E2E_STAFF_PASSWORD",
    "E2E_SEED_SECRET",
    "E2E_TARGET_ID",
    "NEXT_PUBLIC_CONVEX_SITE_URL",
  ].filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Authenticated E2E prerequisites are missing: ${missing.join(", ")}. ` +
        "Use bun run test:e2e:optional for discovery without authenticated proof."
    );
  }

  const target = env.E2E_PROVISIONING_TARGET?.trim();
  if (!(target === "development" || target === "preview")) {
    throw new Error(
      "E2E_PROVISIONING_TARGET must be explicitly set to development or preview; production is forbidden."
    );
  }
  if (env.VERCEL_ENV?.trim() === "production") {
    throw new Error("Authenticated E2E provisioning is forbidden when VERCEL_ENV=production.");
  }

  const frontend = parseUrl(baseUrl, "BROWSER_SMOKE_BASE_URL");
  const convexSite = parseUrl(env.NEXT_PUBLIC_CONVEX_SITE_URL, "NEXT_PUBLIC_CONVEX_SITE_URL");
  if (target === "development" && !LOOPBACK_HOSTS.has(frontend.hostname)) {
    throw new Error("A development E2E target requires a loopback BROWSER_SMOKE_BASE_URL.");
  }
  if (target === "development" && !LOOPBACK_HOSTS.has(convexSite.hostname)) {
    throw new Error("A development E2E target requires a loopback NEXT_PUBLIC_CONVEX_SITE_URL.");
  }
  if (
    target === "preview" &&
    (frontend.protocol !== "https:" || LOOPBACK_HOSTS.has(frontend.hostname))
  ) {
    throw new Error(
      "A preview E2E target requires an explicit non-loopback HTTPS BROWSER_SMOKE_BASE_URL."
    );
  }
  if (
    target === "preview" &&
    (convexSite.protocol !== "https:" || LOOPBACK_HOSTS.has(convexSite.hostname))
  ) {
    throw new Error(
      "A preview E2E target requires a non-loopback HTTPS NEXT_PUBLIC_CONVEX_SITE_URL."
    );
  }

  return { mode: "ready", target };
}
