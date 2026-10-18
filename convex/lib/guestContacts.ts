import type { Infer } from "convex/values";
import { ConvexError, v } from "convex/values";

export const marketingConsentValidator = v.union(
  v.literal("not_recorded"),
  v.literal("granted"),
  v.literal("withdrawn")
);

export const guestContactArgs = {
  contactNo: v.optional(v.string()),
  email: v.optional(v.string()),
  marketingConsent: v.optional(marketingConsentValidator),
  marketingConsentNote: v.optional(v.string()),
};

interface GuestContactInput {
  contactNo?: string;
  email?: string;
  marketingConsent?: Infer<typeof marketingConsentValidator>;
  marketingConsentNote?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NON_DIGIT_PATTERN = /\D/g;
const PHONE_PATTERN = /^[+\d\s().-]+$/;

function normalizedContacts(input: GuestContactInput, existing?: GuestContactInput) {
  const patch: GuestContactInput = {};
  if (input.email !== undefined) {
    const email = input.email.trim().toLowerCase();
    if (email && (email.length > 254 || !EMAIL_PATTERN.test(email))) {
      throw new ConvexError("Enter a valid email address");
    }
    patch.email = email;
  }
  if (input.contactNo !== undefined && input.contactNo !== existing?.contactNo) {
    const phone = input.contactNo.trim();
    const digits = phone.replace(NON_DIGIT_PATTERN, "");
    if (phone && (!PHONE_PATTERN.test(phone) || digits.length < 7 || digits.length > 15)) {
      throw new ConvexError("Enter a cell number with 7 to 15 digits and country code");
    }
    patch.contactNo = phone;
  }
  return patch;
}

export function guestContactPatch(
  input: GuestContactInput,
  actorId: string,
  now: number,
  existing?: GuestContactInput
) {
  const patch: GuestContactInput & {
    marketingConsentRecordedAt?: number;
    marketingConsentRecordedBy?: string;
  } = {};
  Object.assign(patch, normalizedContacts(input, existing));
  if (input.marketingConsent !== undefined || input.marketingConsentNote !== undefined) {
    const status = input.marketingConsent ?? existing?.marketingConsent ?? "not_recorded";
    const note = (input.marketingConsentNote ?? existing?.marketingConsentNote ?? "").trim();
    if (note.length > 1000) {
      throw new ConvexError("Keep consent evidence under 1000 characters");
    }
    if (status === "granted" && !note) {
      throw new ConvexError(
        "Record consent evidence before marking promotional permission granted"
      );
    }
    patch.marketingConsent = status;
    patch.marketingConsentNote = note;
    if (status !== existing?.marketingConsent || note !== existing?.marketingConsentNote) {
      patch.marketingConsentRecordedAt = now;
      patch.marketingConsentRecordedBy = actorId;
    }
  }
  // Permission belongs to the address the guest supplied, not a future replacement.
  if (
    existing?.marketingConsent === "granted" &&
    patch.email !== undefined &&
    patch.email !== existing.email
  ) {
    patch.marketingConsent = "not_recorded";
    patch.marketingConsentNote = "Email address changed. Obtain fresh promotional permission.";
    patch.marketingConsentRecordedAt = now;
    patch.marketingConsentRecordedBy = actorId;
  }
  return patch;
}
