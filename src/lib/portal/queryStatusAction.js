import { PORTAL_PERMISSIONS as P } from "./constants.js";

export function buildQueryStatusInitial(row) {
  return {
    approxMargin: row.approxMargin == null ? "" : String(row.approxMargin),
    budgetAmount: String(row.budgetAmount || ""),
    contractingAirlinesCost: String(row.contractingAirlinesCost ?? ""),
    contractingLandCost: String(row.contractingLandCost ?? ""),
    contractingStatus: row.contractingStatus,
    contractingVisaCost: String(row.contractingVisaCost ?? ""),
    leadStage: row.leadStage || "Inquiry",
    lostReason: row.lostReason || "",
    queryId: row.id,
    salesDecision: row.salesStatus || "Proposal in discussion",
    salesStatus: row.salesStatus,
  };
}

export function buildQueryStatusAction(row, has) {
  const isContractingOnly = has(P.MANAGE_CONTRACTING) && !has(P.MANAGE_QUERIES);
  return {
    initial: buildQueryStatusInitial(row),
    label: isContractingOnly ? "Status" : "Sales Decision",
    modal: isContractingOnly ? "queryStatus" : "salesDecision",
  };
}
