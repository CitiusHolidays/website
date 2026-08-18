const PORTAL_DISPLAY_TERMS = {
  "Proposal in discussion": "Under Discussion",
} satisfies Readonly<Record<string, string>>;

/**
 * Adapts compatibility literals at the presentation boundary without changing
 * the values stored by Convex or submitted by portal commands.
 */
export function displayPortalTerm(value: string | null | undefined): string {
  const term = value?.trim() ?? "";
  return hasOwnKey(PORTAL_DISPLAY_TERMS, term) ? PORTAL_DISPLAY_TERMS[term] : term;
}

import { hasOwnKey } from "../runtimeValues";
