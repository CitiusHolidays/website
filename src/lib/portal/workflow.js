import {
  CONTRACTING_STATUSES,
  PAYMENT_TERMS_BY_QUERY_TYPE,
  PIPELINE_STAGES,
  TICKET_STATUSES,
  VISA_STATUSES,
} from "./constants";

export function getPaymentTermForQueryType(queryType) {
  return PAYMENT_TERMS_BY_QUERY_TYPE[queryType] || {
    minAdvancePercent: 70,
    maxAdvancePercent: 100,
  };
}

export function getPipelineStage(query) {
  if (query?.salesStatus === "Order Lost" || query?.contractingStatus === "Order Lost") {
    return "Order Lost";
  }
  if (query?.salesStatus === "Order Confirmed" || query?.contractingStatus === "Order Confirmed") {
    return "Order Confirmed";
  }
  if (CONTRACTING_STATUSES.includes(query?.contractingStatus)) {
    return query.contractingStatus;
  }
  return "Query Received";
}

export function getPipelineBuckets(queries = []) {
  const buckets = Object.fromEntries(PIPELINE_STAGES.map((stage) => [stage, []]));
  for (const query of queries) {
    const stage = getPipelineStage(query);
    buckets[stage] = buckets[stage] || [];
    buckets[stage].push(query);
  }
  return buckets;
}

export function isClosedQuery(query) {
  return ["Order Confirmed", "Order Lost"].includes(getPipelineStage(query));
}

export function isVisaComplete(status) {
  return status === "Approved" || status === "Not Required";
}

export function isTicketComplete(status) {
  return status === "Issued" || status === "Refunded" || status === "Cancelled";
}

export function isValidVisaStatus(status) {
  return VISA_STATUSES.includes(status);
}

export function isValidTicketStatus(status) {
  return TICKET_STATUSES.includes(status);
}
