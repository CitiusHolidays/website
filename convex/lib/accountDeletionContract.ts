/**
 * Self-service account deletion contract shared by the Convex functions, the web Account settings
 * and the future customer app (ADR 0019). Keep these values in one place: the server enforces them
 * and the clients only describe them.
 */

/** The exact text an Account Holder types to confirm deletion. */
export const ACCOUNT_DELETION_CONFIRMATION_PHRASE = "DELETE";

/** Deletion needs a session signed in no longer ago than this. */
export const ACCOUNT_DELETION_REAUTH_WINDOW_MS = 10 * 60 * 1000;

/** Error codes thrown by `accountDeletion.deleteMyAccount` as `ConvexError` string data. */
export const ACCOUNT_DELETION_ERRORS = {
  confirmationRequired: "ACCOUNT_DELETION_CONFIRMATION_REQUIRED",
  identityConflict: "AUTH_IDENTITY_CONFLICT",
  reauthenticationRequired: "REAUTHENTICATION_REQUIRED",
  staffAccount: "STAFF_ACCOUNT_DELETION_REFUSED",
  tooLarge: "ACCOUNT_DELETION_TOO_LARGE",
  unauthorized: "UNAUTHORIZED",
} as const;

export type AccountDeletionErrorCode =
  (typeof ACCOUNT_DELETION_ERRORS)[keyof typeof ACCOUNT_DELETION_ERRORS];

export function isAccountDeletionConfirmed(value: string) {
  return value.trim() === ACCOUNT_DELETION_CONFIRMATION_PHRASE;
}
