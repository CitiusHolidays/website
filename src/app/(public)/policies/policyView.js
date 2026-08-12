export const POLICY_VIEW_HREFS = {
  billing: "/policies?view=billing",
  terms: "/policies?view=terms",
};

export function resolvePolicyView(view) {
  return view === "billing" ? "billing" : "terms";
}
