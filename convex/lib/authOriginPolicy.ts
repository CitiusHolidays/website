export interface AuthOriginEnvironment {
  BETTER_AUTH_URL?: string;
  NEXT_PUBLIC_APP_URL?: string;
  NEXT_PUBLIC_SITE_URL?: string;
  NODE_ENV?: string;
  SITE_URL?: string;
}

const AUTH_ORIGIN_KEYS = ["BETTER_AUTH_URL", "SITE_URL", "NEXT_PUBLIC_APP_URL"] as const;

export class AuthOriginConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthOriginConfigurationError";
  }
}

function httpOrigin(value: string) {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    // biome-ignore lint/style/useErrorCause: URL parser causes may echo the rejected configuration value.
    throw new AuthOriginConfigurationError("Configure a valid authentication origin URL");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new AuthOriginConfigurationError("Configure an HTTP(S) authentication origin URL");
  }
  return parsed.origin;
}

export function configuredAuthOriginEntries(env: AuthOriginEnvironment) {
  return AUTH_ORIGIN_KEYS.flatMap((key) => {
    const value = env[key]?.trim();
    return value ? [{ key, origin: httpOrigin(value) }] : [];
  });
}

export function resolveAuthOrigin(env: AuthOriginEnvironment) {
  const configured = configuredAuthOriginEntries(env);
  if (configured.length === 0) {
    if (env.NODE_ENV === "production") {
      throw new AuthOriginConfigurationError("Configure an authentication origin");
    }
    return "http://localhost:3000";
  }
  const [selected] = configured;
  const mismatch = configured.find((entry) => entry.origin !== selected.origin);
  if (mismatch) {
    throw new AuthOriginConfigurationError(
      `${mismatch.key} must resolve to the same authentication origin as ${selected.key}`
    );
  }
  return selected.origin;
}

export function deprecatedPublicSiteUrlError(env: AuthOriginEnvironment, authOrigin: string) {
  const deprecated = env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!deprecated) {
    return null;
  }
  try {
    return httpOrigin(deprecated) === authOrigin
      ? null
      : "NEXT_PUBLIC_SITE_URL is deprecated and must not conflict with the authentication origin";
  } catch {
    return "NEXT_PUBLIC_SITE_URL is deprecated and must be an absolute HTTP(S) URL when present";
  }
}
