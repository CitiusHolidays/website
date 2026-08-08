import { TICKETING_SCOPE_OPTIONS } from "@/lib/portal/constants";

export function normalizedTicketingScope(scope) {
  const value = String(scope ?? "").trim();
  if (!value) {
    return;
  }
  if (!TICKETING_SCOPE_OPTIONS.includes(value)) {
    throw new Error("Select a valid Ticketing Scope.");
  }
  return value;
}

export function withoutUndefinedValues(payload) {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
}
