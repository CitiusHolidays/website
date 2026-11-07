import { components } from "../_generated/api";
import type { MutationCtx } from "../_generated/server";

const HEX_PAIR = /../g;

/**
 * Better Auth's verification row for a sign-in link: `magic-link:` and the base64url SHA-256 of
 * the token (`storeToken: "hashed"`). Our request row keeps the same SHA-256 as hex, so the row
 * names its own verification row without keeping the token.
 */
export function magicLinkIdentifier(tokenDigest: string) {
  const bytes = (tokenDigest.match(HEX_PAIR) ?? []).map((pair) => Number.parseInt(pair, 16));
  const base64 = btoa(String.fromCharCode(...bytes));
  return `magic-link:${base64.replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "")}`;
}

/**
 * Deletes the Better Auth verification rows (expired or not) behind these sign-in requests: each
 * holds the address the link was sent to. Returns how many were still there.
 */
export async function deleteSignInVerifications(ctx: MutationCtx, tokenDigests: string[]) {
  const removed = await Promise.all(
    tokenDigests.map((tokenDigest) =>
      ctx.runMutation(components.betterAuth.adapter.deleteOne, {
        input: {
          model: "verification",
          where: [{ field: "identifier", operator: "eq", value: magicLinkIdentifier(tokenDigest) }],
        },
      })
    )
  );
  return removed.filter(Boolean).length;
}
