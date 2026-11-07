import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { createActivity, type PortalAccess } from "./lib";
import {
  decideParentalConsent,
  type ParentalConsentChange,
  type ParentalConsentRequest,
} from "./travellerGuardianPolicy";

type StoredParentalConsent = NonNullable<Doc<"travellers">["parentalConsent"]>;

/**
 * The next "Parental consent received" mark for a traveller (ADR 0018), recorded by the signed-in
 * staff member at server time. Callers decide what a refused request means: the editor rejects
 * it, the import ignores it with a row message.
 */
export function parentalConsentDecisionFor(
  access: PortalAccess,
  current: StoredParentalConsent | undefined,
  isMinor: boolean | undefined,
  request: ParentalConsentRequest | undefined,
  now: number
) {
  const decision = decideParentalConsent<Id<"staffUsers">>({
    actor: { name: access.name || access.email || "Unknown staff member", staffId: access.staffId },
    current,
    isMinor,
    now,
    request,
  });
  // The stored (schema) shape, so the mark can go straight into a traveller patch.
  const next: StoredParentalConsent | undefined = decision.next;
  return { ...decision, next };
}

const CONSENT_ACTIVITY = {
  cleared: {
    action: "parental_consent_cleared",
    message: (fullName) => `Cleared parental consent for ${fullName}`,
  },
  cleared_not_minor: {
    action: "parental_consent_cleared",
    message: (fullName) => `Cleared parental consent for ${fullName}: no longer a minor`,
  },
  note_updated: {
    action: "parental_consent_note_updated",
    message: (fullName) => `Updated the parental consent note for ${fullName}`,
  },
  recorded: {
    action: "parental_consent_recorded",
    message: (fullName) => `Recorded parental consent for ${fullName}`,
  },
} satisfies Record<
  ParentalConsentChange,
  { action: string; message: (fullName: string) => string }
>;

/** One content-light activity entry per change; the note text is never logged. */
export async function logParentalConsentChange(
  ctx: MutationCtx,
  access: PortalAccess,
  traveller: { fullName: string; id: Id<"travellers"> },
  change: ParentalConsentChange | null
) {
  if (!change) {
    return;
  }
  const entry = CONSENT_ACTIVITY[change];
  await createActivity(ctx, access, {
    action: entry.action,
    entityId: traveller.id,
    entityType: "traveller",
    message: entry.message(traveller.fullName.trim()),
  });
}

/** The mark as the Staff Workspace row shows it: who recorded it, when, and the note. */
export function publicParentalConsent(traveller: Doc<"travellers">) {
  const mark = traveller.isMinor === true ? traveller.parentalConsent : undefined;
  return mark
    ? { note: mark.note ?? "", receivedAt: mark.receivedAt, recordedByName: mark.recordedByName }
    : null;
}
