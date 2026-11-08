export const POLICY_VIEW_HREFS = {
  billing: "/policies?view=billing",
  privacy: "/policies?view=privacy",
  terms: "/policies?view=terms",
};

export function resolvePolicyView(view) {
  return view === "billing" || view === "privacy" ? view : "terms";
}
