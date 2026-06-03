import { components } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import { normalizeEmail } from "../crm/lib";

export type BetterAuthUserRow = {
  _id: string;
  email?: string;
  emailVerified?: boolean;
  name?: string;
};

export type BetterAuthAccountRow = {
  providerId: string;
  password?: string | null;
};

export async function findAuthUserByEmail(
  ctx: ActionCtx,
  email: string,
): Promise<BetterAuthUserRow | null> {
  const emailNormalized = normalizeEmail(email);
  const candidates = [emailNormalized, email.trim()];
  const authUsers = await Promise.all(
    candidates.map((candidate) =>
      ctx.runQuery(components.betterAuth.adapter.findOne, {
        model: "user",
        where: [{ field: "email", value: candidate }],
      }),
    ),
  );
  for (const authUser of authUsers) {
    if (authUser && typeof authUser === "object" && "_id" in authUser) {
      return authUser as BetterAuthUserRow;
    }
  }
  return null;
}

export async function findAuthAccountsByUserId(
  ctx: ActionCtx,
  userId: string,
): Promise<BetterAuthAccountRow[]> {
  const result = await ctx.runQuery(components.betterAuth.adapter.findMany, {
    model: "account",
    where: [{ field: "userId", value: userId }],
    paginationOpts: { numItems: 32, cursor: null },
  });
  const accounts = Array.isArray(result)
    ? result
    : result && typeof result === "object" && "page" in result && Array.isArray(result.page)
      ? result.page
      : [];
  return accounts as BetterAuthAccountRow[];
}

export function authAccountSummary(accounts: BetterAuthAccountRow[]) {
  const hasCredential = accounts.some(
    (account) => account.providerId === "credential" && Boolean(account.password),
  );
  const hasGoogle = accounts.some((account) => account.providerId === "google");
  return { hasCredential, hasGoogle };
}
