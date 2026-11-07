import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";

const RECEIPT_HASH_DOMAIN = "citius-account-deletion:v1:";

/**
 * One-way, domain-separated digest of the deleted identity. The receipt and every detached record
 * carry only this value, so a retry can find its receipt without the receipt holding personal data.
 */
export async function accountDeletionSubjectHash(canonicalAuthUserId: string) {
  const bytes = new TextEncoder().encode(`${RECEIPT_HASH_DOMAIN}${canonicalAuthUserId}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** The owner value written into kept records once their account is deleted. */
export function deletedAccountTombstone(subjectHash: string) {
  return `deleted-account:${subjectHash}`;
}

/** The short reference shown to the customer and quoted to support. */
export function accountDeletionReference(subjectHash: string) {
  return subjectHash.slice(0, 16).toUpperCase();
}

export async function findAccountDeletionReceipt(
  ctx: QueryCtx | MutationCtx,
  canonicalAuthUserId: string
) {
  const subjectHash = await accountDeletionSubjectHash(canonicalAuthUserId);
  return await ctx.db
    .query("accountDeletionReceipts")
    .withIndex("by_subjectHash", (q) => q.eq("subjectHash", subjectHash))
    .first();
}

/**
 * A Convex token stays valid for a short time after its Better Auth session is deleted. Refuse to
 * recreate any account-owned state for an identity whose account was deleted.
 */
export async function assertAccountNotDeleted(ctx: MutationCtx, canonicalAuthUserId: string) {
  if (await findAccountDeletionReceipt(ctx, canonicalAuthUserId)) {
    throw new ConvexError("ACCOUNT_DELETED");
  }
}
