import {
  CONTRACTING_STATUSES,
  PAYMENT_TERMS_BY_QUERY_TYPE,
  PIPELINE_STAGES,
  SALES_PIPELINE_STAGES,
  TICKET_STATUSES,
  VISA_STATUSES,
} from "./constants";

export function getPaymentTermForQueryType(queryType) {
  return (
    PAYMENT_TERMS_BY_QUERY_TYPE[queryType] || {
      minAdvancePercent: 70,
      maxAdvancePercent: 100,
    }
  );
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

export function getSalesPipelineStage(query) {
  if (query?.leadStage) {
    return query.leadStage;
  }
  if (query?.salesStatus === "Order Lost" || query?.contractingStatus === "Order Lost") {
    return "Lost";
  }
  if (query?.salesStatus === "Order Confirmed" || query?.contractingStatus === "Order Confirmed") {
    return "Confirmation";
  }
  if (query?.contractingStatus === "Proposal sent") {
    return "Proposal";
  }
  if (
    ["Proposal in progress", "Change in destination", "Date/Destination Change Required"].includes(
      query?.contractingStatus,
    )
  ) {
    return "Negotiation";
  }
  return "Inquiry";
}

export function getSalesPipelineBuckets(queries = []) {
  const buckets = Object.fromEntries(SALES_PIPELINE_STAGES.map((stage) => [stage, []]));
  for (const query of queries) {
    const stage = getSalesPipelineStage(query);
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

export function getExpenseSplitTotal({ cardAmount = 0, cashAmount = 0, epayAmount = 0 } = {}) {
  const parts = [cardAmount, cashAmount, epayAmount].map((value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  });
  return parts.reduce((sum, value) => sum + value, 0);
}
