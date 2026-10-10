export function queryHistoryScopeForView(view: string, filters: Record<string, string>) {
  if (!(view === "queries" || view === "contracting")) {
    return;
  }
  const statusField = view === "contracting" ? "contractingStatus" : "salesStatus";
  return filters[statusField] === "Order Lost" ? ("lost" as const) : ("active" as const);
}
