const PORTAL_DISPLAY_TERMS: Readonly<Record<string, string>> = {
  "Proposal in discussion": "Under Discussion",
};

/**
 * Adapts compatibility literals at the presentation boundary without changing
 * the values stored by Convex or submitted by portal commands.
 */
export function displayPortalTerm(value: string | null | undefined): string {
  const term = value?.trim() ?? "";
  return PORTAL_DISPLAY_TERMS[term] ?? term;
}
