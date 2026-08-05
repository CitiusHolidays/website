/**
 * Canonical identity seam for the pending auth-id migration.
 *
 * Convex's tokenIdentifier is the stable, issuer-qualified identifier. Older
 * rows in this app use `subject`, so callers can adopt this helper during the
 * dual-read window without changing ownership semantics in one large deploy.
 */
export type AuthIdentityLike = {
  subject?: string | null;
  tokenIdentifier?: string | null;
};

export function canonicalAuthUserId(identity: AuthIdentityLike): string | null {
  const tokenIdentifier = identity.tokenIdentifier?.trim();
  if (tokenIdentifier) {
    return tokenIdentifier;
  }
  const subject = identity.subject?.trim();
  return subject || null;
}

export function legacyAuthUserId(identity: AuthIdentityLike): string | null {
  const subject = identity.subject?.trim();
  return subject || null;
}

export function authIdentityCandidates(identity: AuthIdentityLike): string[] {
  const candidates = [canonicalAuthUserId(identity), legacyAuthUserId(identity)].filter(
    (candidate): candidate is string => Boolean(candidate)
  );
  return Array.from(new Set(candidates));
}
