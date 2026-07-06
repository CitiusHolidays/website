import { PORTAL_PERMISSIONS as P } from "./constants.js";

export function buildQueryStatusInitial(row) {
  return {
    queryId: row.id,
    salesStatus: row.salesStatus,
    salesDecision: row.salesStatus || "Proposal in discussion",
    leadStage: row.leadStage || "Inquiry",
    contractingStatus: row.contractingStatus,
    budgetAmount: String(row.budgetAmount || ""),
    contractingLandCost: String(row.contractingLandCost ?? ""),
    contractingAirlinesCost: String(row.contractingAirlinesCost ?? ""),
    contractingVisaCost: String(row.contractingVisaCost ?? ""),
    approxMargin: row.approxMargin != null ? String(row.approxMargin) : "",
    lostReason: row.lostReason || "",
  };
}

export function buildQueryStatusAction(row, has) {
  const isContractingOnly = has(P.MANAGE_CONTRACTING) && !has(P.MANAGE_QUERIES);
  return {
    modal: isContractingOnly ? "queryStatus" : "salesDecision",
    label: isContractingOnly ? "Status" : "Sales Decision",
    initial: buildQueryStatusInitial(row),
  };
}
