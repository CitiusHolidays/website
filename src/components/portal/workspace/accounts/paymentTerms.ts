import type { PortalPaymentTermsReferenceRow } from "../portalViewTypes";

export const PAYMENT_TERMS_REFERENCE_ROWS: PortalPaymentTermsReferenceRow[] = [
  {
    advance: "70-90%",
    balance: "10-30%",
    id: "mice",
    notify: "Sales, Contracting, Operations, Finance",
    type: "MICE / MICE Bidding",
  },
  {
    advance: "70-90%",
    balance: "10-30%",
    id: "cement",
    notify: "Sales, Contracting, Operations, Finance",
    type: "Cement",
  },
  {
    advance: "70-100%",
    balance: "0-30%",
    id: "cement-bid",
    notify: "Sales, Contracting, Operations, Finance",
    type: "Cement Bidding",
  },
  {
    advance: "90-100%",
    balance: "0-10%",
    id: "fit",
    notify: "Sales, Contracting, Operations, Finance",
    type: "FIT / Family Group",
  },
  {
    advance: "80-100%",
    balance: "0-20%",
    id: "b2b",
    notify: "Sales, Contracting, Finance",
    type: "B2B",
  },
  {
    advance: "Per plan",
    balance: "-",
    id: "spiritual",
    notify: "Sales, Operations, Finance",
    type: "Spiritual",
  },
];

export function paymentTermLabel(queryType: string | undefined) {
  if (queryType === "Spiritual") {
    return "100% advance";
  }
  if (queryType === "B2B") {
    return "80%-100% advance";
  }
  if (queryType === "FIT" || queryType === "Family Group") {
    return "90%-100% advance";
  }
  if (queryType === "Cement Bidding") {
    return "70%-100% advance";
  }
  return "70%-90% advance";
}
