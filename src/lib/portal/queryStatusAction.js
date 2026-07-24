import { PORTAL_PERMISSIONS as P } from "./constants.js";

export function buildQueryStatusInitial(row) {
  return {
    airfarePerPax: String(row.airfarePerPax ?? ""),
    approxMargin:
      row.approxMargin === null || row.approxMargin === undefined ? "" : String(row.approxMargin),
    budgetAmount: String(row.budgetAmount || ""),
    confirmedPax: String(row.confirmedPax ?? row.paxCount ?? ""),
    contractingAirlinesCost: String(row.contractingAirlinesCost ?? ""),
    contractingLandCost: String(row.contractingLandCost ?? ""),
    contractingStatus: row.contractingStatus,
    contractingVisaCost: String(row.contractingVisaCost ?? ""),
    destination: row.destination || "",
    landCostPerPax: String(row.landCostPerPax ?? ""),
    leadStage: row.leadStage || "Inquiry",
    lostReason: row.lostReason || "",
    proposalId: row.proposalId || "",
    queryId: row.id,
    salesDecision: row.salesStatus || "Proposal in discussion",
    salesStatus: row.salesStatus,
    sellingPricePerPax: String(row.sellingPricePerPax ?? ""),
    travelEndDate: row.travelEndDate || "",
    travelStartDate: row.travelStartDate || "",
    visaCostPerPax: String(row.visaCostPerPax ?? ""),
  };
}

export function buildQueryStatusAction(row, has) {
  const isContractingOnly = has(P.MANAGE_CONTRACTING) && !has(P.MANAGE_QUERIES);
  if (!isContractingOnly && row.salesStatus === "Order Confirmed") {
    return null;
  }
  return {
    initial: buildQueryStatusInitial(row),
    label: isContractingOnly ? "Status" : "Sales Decision",
    modal: isContractingOnly ? "queryStatus" : "salesDecision",
  };
}
