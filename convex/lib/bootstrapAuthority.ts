/**
 * Bootstrap admins are a deliberately temporary break-glass path. Keeping the
 * parsing and expiry rules in one small module makes the policy testable without
 * invoking Convex and prevents an accidentally missing expiry from becoming an
 * indefinite Admin grant.
 */
export const BOOTSTRAP_EXPIRY_ENV = "PORTAL_BOOTSTRAP_ADMINS_EXPIRES_AT";

type BootstrapEnv = Record<string, string | undefined>;
const NUMERIC_EXPIRY_PATTERN = /^\d+$/;

const normalizeEmail = (email?: string | null) =>
  String(email ?? "")
    .trim()
    .toLowerCase();

function parseExpiry(value: string | undefined) {
  if (!value?.trim()) {
    return null;
  }
  const raw = value.trim();
  const numeric = NUMERIC_EXPIRY_PATTERN.test(raw) ? Number(raw) : Date.parse(raw);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

export function getBootstrapAdminEmails(env: BootstrapEnv = process.env) {
  return (env.PORTAL_BOOTSTRAP_ADMINS ?? "").split(",").flatMap((email) => {
    const normalized = normalizeEmail(email);
    return normalized ? [normalized] : [];
  });
}

export function getBootstrapAuthority(env: BootstrapEnv = process.env, at = Date.now()) {
  const emails = getBootstrapAdminEmails(env);
  const expiresAt = parseExpiry(env[BOOTSTRAP_EXPIRY_ENV]);
  const configured = emails.length > 0;
  const active = configured && expiresAt !== null && expiresAt > at;

  return {
    active,
    configured,
    emails,
    expiresAt,
  };
}

export function isBootstrapAdmin(email: string, env: BootstrapEnv = process.env, at = Date.now()) {
  const authority = getBootstrapAuthority(env, at);
  return authority.active && authority.emails.includes(normalizeEmail(email));
}

export function getBootstrapAuthorityExpiry(env: BootstrapEnv = process.env) {
  return parseExpiry(env[BOOTSTRAP_EXPIRY_ENV]);
}
