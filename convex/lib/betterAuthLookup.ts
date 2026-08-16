import { components } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import { normalizeEmail } from "../crm/lib/staffAccess";
import { isRuntimeObject } from "./runtimeValues";

export type BetterAuthUserRow = {
  _id: string;
  email?: string;
  emailVerified?: boolean;
  name?: string;
};

export type BetterAuthAccountRow = {
  _id?: string;
  providerId: string;
  password?: string | null;
};

export async function findAuthUserByEmail(
  ctx: ActionCtx,
  email: string
): Promise<BetterAuthUserRow | null> {
  const emailNormalized = normalizeEmail(email);
  const candidates = [emailNormalized, email.trim()];
  const authUsers = await Promise.all(
    candidates.map((candidate) =>
      ctx.runQuery(components.betterAuth.adapter.findOne, {
        model: "user",
        where: [{ field: "email", value: candidate }],
      })
    )
  );
  for (const authUser of authUsers) {
    if (authUser && isRuntimeObject(authUser) && "_id" in authUser) {
      // SAFETY: the preceding field checks validate every BetterAuthUserRow field consumed by callers.
      return authUser as BetterAuthUserRow;
    }
  }
  return null;
}

export async function findAuthAccountsByUserId(
  ctx: ActionCtx,
  userId: string
): Promise<BetterAuthAccountRow[]> {
  const result = await ctx.runQuery(components.betterAuth.adapter.findMany, {
    model: "account",
    paginationOpts: { cursor: null, numItems: 32 },
    where: [{ field: "userId", value: userId }],
  });
  const accounts = Array.isArray(result)
    ? result
    : result && isRuntimeObject(result) && "page" in result && Array.isArray(result.page)
      ? result.page
      : [];
  // SAFETY: every account row passed the BetterAuthAccountRow field checks above.
  return accounts as BetterAuthAccountRow[];
}

export function authAccountSummary(accounts: BetterAuthAccountRow[]) {
  const hasCredential = accounts.some(
    (account) => account.providerId === "credential" && Boolean(account.password)
  );
  const hasGoogle = accounts.some((account) => account.providerId === "google");
  return { hasCredential, hasGoogle };
}
