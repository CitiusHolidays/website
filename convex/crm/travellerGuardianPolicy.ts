/**
 * Minor and guardian rules for Travellers on one Job Card (ADR 0018).
 *
 * A Minor is a Traveller under 18 on the trip's start date. A minor may be linked to one
 * Guardian: an adult Traveller on the same Job Card. These functions are pure so the import
 * sweep, the manual edit and the tests share one definition.
 */

export const MINOR_AGE_LIMIT = 18;
/** Owner decision 2026-11-06: a minor may have up to two guardians (for example both parents). */
export const MAX_GUARDIANS = 2;
const MAX_PLAUSIBLE_AGE = 130;
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const NON_NAME_CHARACTERS = /[^\p{L}\p{N}]+/gu;
const NON_DIGITS = /\D+/g;
const PHONE_COMPARISON_DIGITS = 10;
const MIN_PHONE_DIGITS = 7;

export type MinorStatusFlag = "adult" | "minor";

export interface MinorEvidence {
  ageYears?: number;
  birthDate?: string;
  minorStatus?: MinorStatusFlag;
}

export interface GuardianCandidate {
  contactNo?: string;
  email?: string;
  fullName: string;
  givenName?: string;
  id: string;
  isMinor?: boolean;
  jobCardId: string;
  surname?: string;
}

export interface GuardianReference {
  contact?: string;
  name: string;
}

export type GuardianResolution =
  | { guardianId: string; kind: "linked" }
  | {
      kind:
        | "age_unknown"
        | "ambiguous"
        | "contact_mismatch"
        | "guardian_is_minor"
        | "not_minor"
        | "self"
        | "unmatched";
      message: string;
    };

/** Returns the date as YYYY-MM-DD when it is a real calendar date, otherwise null. */
export function normalizeIsoDate(value: string | null | undefined): string | null {
  const match = String(value ?? "")
    .trim()
    .match(ISO_DATE_PATTERN);
  if (!match) {
    return null;
  }
  const [, year, month, day] = match.map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  const isCalendarDate =
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day;
  return isCalendarDate ? match[0] : null;
}

/** Whole years between two ISO dates, or null when either date is unusable or reversed. */
export function ageOnDate(birthDate: string, referenceDate: string): number | null {
  const birth = normalizeIsoDate(birthDate);
  const reference = normalizeIsoDate(referenceDate);
  if (!(birth && reference) || birth > reference) {
    return null;
  }
  const [birthYear, birthMonth, birthDay] = birth.split("-").map(Number);
  const [referenceYear, referenceMonth, referenceDay] = reference.split("-").map(Number);
  const hadBirthday =
    referenceMonth > birthMonth || (referenceMonth === birthMonth && referenceDay >= birthDay);
  return referenceYear - birthYear - (hadBirthday ? 0 : 1);
}

/**
 * The date a Traveller's age is measured on: the Travel in Series start, then the Job Card
 * start, then today (UTC) when the trip has no dates yet.
 */
export function minorReferenceDate(
  travelBatchStartDate: string | undefined,
  jobStartDate: string | undefined,
  now: number
) {
  return (
    normalizeIsoDate(travelBatchStartDate) ??
    normalizeIsoDate(jobStartDate) ??
    new Date(now).toISOString().slice(0, 10)
  );
}

/** Explicit Minor column first, then Age, then date of birth. Unknown stays undefined. */
export function resolveMinorStatus(
  evidence: MinorEvidence,
  referenceDate: string
): boolean | undefined {
  if (evidence.minorStatus) {
    return evidence.minorStatus === "minor";
  }
  const { ageYears } = evidence;
  if (
    ageYears !== undefined &&
    Number.isInteger(ageYears) &&
    ageYears >= 0 &&
    ageYears <= MAX_PLAUSIBLE_AGE
  ) {
    return ageYears < MINOR_AGE_LIMIT;
  }
  const age = evidence.birthDate ? ageOnDate(evidence.birthDate, referenceDate) : null;
  return age === null ? undefined : age < MINOR_AGE_LIMIT;
}

export function normalizePersonName(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(NON_NAME_CHARACTERS, " ")
    .trim();
}

/** Normalised names a candidate answers to: the full name and given/surname in either order. */
export function nameVariants(candidate: GuardianCandidate) {
  const given = normalizePersonName(candidate.givenName);
  const surname = normalizePersonName(candidate.surname);
  const variants = new Set([normalizePersonName(candidate.fullName)]);
  if (given && surname) {
    variants.add(`${given} ${surname}`);
    variants.add(`${surname} ${given}`);
  }
  variants.delete("");
  return variants;
}

interface NormalizedContact {
  email?: string;
  phone?: string;
}

export function normalizeContact(value: string | null | undefined): NormalizedContact {
  const text = String(value ?? "").trim();
  if (text.includes("@")) {
    return { email: text.toLowerCase() };
  }
  const digits = text.replace(NON_DIGITS, "");
  return digits.length >= MIN_PHONE_DIGITS ? { phone: digits.slice(-PHONE_COMPARISON_DIGITS) } : {};
}

function contactMatches(candidate: GuardianCandidate, contact: NormalizedContact) {
  if (contact.email) {
    return normalizeContact(candidate.email).email === contact.email;
  }
  return Boolean(contact.phone) && normalizeContact(candidate.contactNo).phone === contact.phone;
}

function displayName(reference: GuardianReference) {
  return reference.name.trim().replace(/\s+/g, " ");
}

/**
 * Resolves a spreadsheet's Parent/Guardian reference for one minor against the Travellers
 * on the same Job Card. It links only when exactly one eligible adult matches; every other
 * outcome is a reason the import reports instead of guessing.
 */
export function resolveGuardianReference(
  minor: GuardianCandidate,
  reference: GuardianReference,
  candidates: readonly GuardianCandidate[]
): GuardianResolution {
  const name = displayName(reference);
  if (minor.isMinor === undefined) {
    return {
      kind: "age_unknown",
      message: `Guardian ${name} not linked: add Date of Birth, Age or Minor for this traveller first.`,
    };
  }
  if (!minor.isMinor) {
    return {
      kind: "not_minor",
      message: `Guardian ${name} not linked: this traveller is not a minor.`,
    };
  }
  const wanted = normalizePersonName(reference.name);
  const sameJob = candidates.filter((candidate) => candidate.jobCardId === minor.jobCardId);
  const named = sameJob.filter((candidate) => wanted && nameVariants(candidate).has(wanted));
  const others = named.filter((candidate) => candidate.id !== minor.id);
  if (named.length > 0 && others.length === 0) {
    return { kind: "self", message: "A traveller cannot be their own guardian." };
  }
  if (others.length === 0) {
    return {
      kind: "unmatched",
      message: `Guardian ${name} not linked: no traveller with that name on this Job Card.`,
    };
  }
  const contact = normalizeContact(reference.contact);
  const contacted =
    contact.email || contact.phone
      ? others.filter((candidate) => contactMatches(candidate, contact))
      : others;
  if (contacted.length === 0) {
    return {
      kind: "contact_mismatch",
      message: `Guardian ${name} not linked: the name matches but the contact does not.`,
    };
  }
  const eligible = contacted.filter((candidate) => candidate.isMinor !== true);
  if (eligible.length === 0) {
    return {
      kind: "guardian_is_minor",
      message: `Guardian ${name} not linked: a minor cannot be a guardian.`,
    };
  }
  if (eligible.length > 1) {
    return {
      kind: "ambiguous",
      message: `Guardian ${name} not linked: ${eligible.length} travellers match. Add the guardian's contact number or email, or link manually.`,
    };
  }
  return { guardianId: eligible[0].id, kind: "linked" };
}

/** Why a manual guardian link is not allowed, or null when it is. */
export function guardianLinkProblem(
  minor: GuardianCandidate,
  guardian: GuardianCandidate
): string | null {
  if (minor.id === guardian.id) {
    return "A traveller cannot be their own guardian.";
  }
  if (minor.jobCardId !== guardian.jobCardId) {
    return "The guardian must be a traveller on the same Job Card.";
  }
  if (minor.isMinor !== true) {
    return "Mark the traveller as a minor before linking a guardian.";
  }
  if (guardian.isMinor === true) {
    return "A minor cannot be a guardian.";
  }
  return null;
}

export interface UnresolvedGuardianReference {
  message: string;
  reference: GuardianReference;
}

export interface GuardianReferenceResolution {
  guardianIds: string[];
  unresolved: UnresolvedGuardianReference[];
}

/**
 * Resolves every guardian a sheet names for one minor. Each name is matched on its own with the
 * unique-adult rule; matches are linked (at most two, never the same adult twice) and every
 * other name is returned with the reason it was not linked.
 */
export function resolveGuardianReferences(
  minor: GuardianCandidate,
  references: readonly GuardianReference[],
  candidatesFor: (reference: GuardianReference) => readonly GuardianCandidate[]
): GuardianReferenceResolution {
  const guardianIds: string[] = [];
  const linked = new Set<string>();
  const unresolved: UnresolvedGuardianReference[] = [];
  for (const reference of references) {
    const resolution = resolveGuardianReference(minor, reference, candidatesFor(reference));
    if (resolution.kind !== "linked") {
      unresolved.push({ message: resolution.message, reference });
    } else if (linked.has(resolution.guardianId)) {
      unresolved.push({
        message: `Guardian ${displayName(reference)} not linked: already named as this minor's guardian.`,
        reference,
      });
    } else if (guardianIds.length >= MAX_GUARDIANS) {
      unresolved.push({
        message: `Guardian ${displayName(reference)} not linked: a minor can have at most two guardians.`,
        reference,
      });
    } else {
      guardianIds.push(resolution.guardianId);
      linked.add(resolution.guardianId);
    }
  }
  return { guardianIds, unresolved };
}

/** Why a manual set of guardians is not allowed, or null when it is. An empty set clears. */
export function guardianSetProblem(
  minor: GuardianCandidate,
  guardians: readonly GuardianCandidate[]
): string | null {
  if (guardians.length > MAX_GUARDIANS) {
    return "A minor can have at most two guardians.";
  }
  if (new Set(guardians.map((guardian) => guardian.id)).size !== guardians.length) {
    return "The same guardian cannot be chosen twice.";
  }
  for (const guardian of guardians) {
    const problem = guardianLinkProblem(minor, guardian);
    if (problem) {
      return problem;
    }
  }
  return null;
}

/** Upper bound on the optional note on the parental consent mark (ADR 0018). */
export const PARENTAL_CONSENT_NOTE_MAX_LENGTH = 500;

/** Operations' "Parental consent received" mark on a minor (ADR 0018). */
export interface ParentalConsentMark<StaffId = string> {
  note?: string;
  receivedAt: number;
  recordedByName: string;
  recordedByStaffId?: StaffId;
}

/** A request to set (`received: true`) or clear the mark; an absent note keeps the stored one. */
export interface ParentalConsentRequest {
  note?: string;
  received: boolean;
}

export type ParentalConsentChange = "cleared" | "cleared_not_minor" | "note_updated" | "recorded";

export interface ParentalConsentDecision<StaffId> {
  change: ParentalConsentChange | null;
  /** The mark to store; undefined removes it. */
  next: ParentalConsentMark<StaffId> | undefined;
  /** True when consent was requested for a traveller who is not a known minor. */
  refused: boolean;
}

/** The trimmed note, or undefined when it is empty. Check the length with the problem below. */
export function normalizeParentalConsentNote(note: string | undefined) {
  const trimmed = String(note ?? "").trim();
  return trimmed || undefined;
}

export function parentalConsentNoteProblem(note: string | undefined): string | null {
  const normalized = normalizeParentalConsentNote(note);
  return normalized && normalized.length > PARENTAL_CONSENT_NOTE_MAX_LENGTH
    ? `The parental consent note can be at most ${PARENTAL_CONSENT_NOTE_MAX_LENGTH} characters.`
    : null;
}

/**
 * The next consent mark. It exists only while the traveller is a known minor, so it is cleared
 * whenever minor status ends, and a request to record it on anyone else is refused. Recording
 * consent that is already recorded keeps who recorded it and when; only the note can change.
 */
export function decideParentalConsent<StaffId>(input: {
  actor: { name: string; staffId?: StaffId };
  current: ParentalConsentMark<StaffId> | undefined;
  isMinor: boolean | undefined;
  now: number;
  request: ParentalConsentRequest | undefined;
}): ParentalConsentDecision<StaffId> {
  const { actor, current, request } = input;
  if (input.isMinor !== true) {
    return {
      change: current ? "cleared_not_minor" : null,
      next: undefined,
      refused: request?.received === true,
    };
  }
  if (!request) {
    return { change: null, next: current, refused: false };
  }
  if (!request.received) {
    return { change: current ? "cleared" : null, next: undefined, refused: false };
  }
  const note =
    request.note === undefined ? current?.note : normalizeParentalConsentNote(request.note);
  if (!current) {
    const recorded: ParentalConsentMark<StaffId> = {
      receivedAt: input.now,
      recordedByName: actor.name,
    };
    if (note) {
      recorded.note = note;
    }
    if (actor.staffId !== undefined) {
      recorded.recordedByStaffId = actor.staffId;
    }
    return { change: "recorded", next: recorded, refused: false };
  }
  if (note === current.note) {
    return { change: null, next: current, refused: false };
  }
  const { note: _previousNote, ...stamp } = current;
  return { change: "note_updated", next: note ? { ...stamp, note } : stamp, refused: false };
}
