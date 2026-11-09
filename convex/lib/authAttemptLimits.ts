/**
 * Limits on email+password sign-in and on the emails a stranger can make us send (sign-up,
 * password-reset requests, verification resends), counted per email address in the Convex
 * database through the rate-limiter component.
 *
 * Why not Better Auth's own limiter: it keys on the client IP from `x-forwarded-for`, and a Convex
 * HTTP action has no client IP it can trust (ADR 0020). Without one, every request shared a
 * single `no-trusted-ip|<path>` bucket per isolate (3 per 10 s for `/sign-in*` and `/sign-up*`),
 * which stopped no attacker and could refuse real people at a busy moment. Those paths are
 * switched off there (`customRules`) and limited here instead.
 *
 * - Per address: the address folded the way the customer app folds it (case, `+tags`, Gmail dots,
 *   Yahoo disposable addresses), so aliases of one inbox share one bucket. The key is a digest;
 *   no address is stored. The limit applies whether or not an account exists, and the refusal is
 *   the same 429 either way, so it reveals nothing about the address.
 * - Overall: a generous ceiling per kind that only logs an alarm. It never refuses anyone: a
 *   refusal for unknown addresses only would tell an attacker which addresses have accounts.
 */
import { sha256Hex, signInInbox } from "./customerAppSignIn";

export type AuthAttemptKind = "auth_email" | "password_sign_in";

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

/** Password attempts one address may take: 10 straight away, then 10 more each 15 minutes. */
export const PASSWORD_SIGN_IN_PER_ADDRESS = 10;
export const PASSWORD_SIGN_IN_PERIOD_MS = 15 * MINUTE_MS;
/** Sign-up, reset-request and verification emails one inbox may be sent: 5 an hour. */
export const AUTH_EMAILS_PER_ADDRESS = 5;
export const AUTH_EMAILS_PERIOD_MS = HOUR_MS;
/** Past these, across every address, an alarm is logged; nobody is refused. */
export const PASSWORD_SIGN_IN_OVERALL_PER_HOUR = 1000;
export const AUTH_EMAILS_OVERALL_PER_HOUR = 300;
/** At most one ceiling alarm per kind in this period, so an attack does not flood the logs. */
export const AUTH_ATTEMPT_ALARM_PERIOD_MS = 10 * MINUTE_MS;

const ATTEMPT_KIND_BY_PATH = new Map<string, AuthAttemptKind>([
  ["/request-password-reset", "auth_email"],
  ["/send-verification-email", "auth_email"],
  ["/sign-in/email", "password_sign_in"],
  ["/sign-up/email", "auth_email"],
]);

/** The Better Auth paths limited here, which its IP-keyed limiter must therefore skip. */
export const AUTH_ATTEMPT_LIMITED_PATHS = [...ATTEMPT_KIND_BY_PATH.keys()];

export function authAttemptKindForPath(path: string) {
  return ATTEMPT_KIND_BY_PATH.get(path) ?? null;
}

export function authAttemptKeyDigest(kind: AuthAttemptKind, email: string) {
  return sha256Hex(`auth-attempt:${kind}:${signInInbox(email)}`);
}
