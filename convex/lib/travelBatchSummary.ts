export type TransitionalTravelBatchSummary = {
  batchCode?: string;
  batchReference?: string;
  code?: string;
  confirmedPax?: number;
  pax?: number;
  reference?: string;
};

const BATCH_CODE_PATTERN = /^B(\d+)$/;
const TRAVEL_BATCH_SUMMARY_FIELDS = new Set([
  "batchCode",
  "batchReference",
  "code",
  "confirmedPax",
  "pax",
  "reference",
]);

export function assertRecognizedTravelBatchSummaries(summaries: TransitionalTravelBatchSummary[]) {
  for (const summary of summaries) {
    const unknownFields = Object.keys(summary).filter(
      (field) => !TRAVEL_BATCH_SUMMARY_FIELDS.has(field)
    );
    if (unknownFields.length > 0) {
      throw new Error(`Unknown Travel Batch summary fields: ${unknownFields.sort().join(", ")}`);
    }
  }
}

export function canonicalTravelBatchSummary(summary: TransitionalTravelBatchSummary) {
  return {
    batchCode: String(summary.batchCode ?? summary.code ?? "").trim(),
    batchReference: String(summary.batchReference ?? summary.reference ?? "").trim(),
    confirmedPax: Math.max(Number(summary.confirmedPax ?? summary.pax ?? 0), 0),
  };
}

export function travelBatchCountFromSummaries(summaries: TransitionalTravelBatchSummary[]) {
  return summaries.reduce((maximum, summary) => {
    const match = canonicalTravelBatchSummary(summary).batchCode.match(BATCH_CODE_PATTERN);
    return Math.max(maximum, match ? Number(match[1]) : 0);
  }, 0);
}

export function travelBatchSummaryVariant(summary: TransitionalTravelBatchSummary) {
  return summary.code !== undefined || summary.reference !== undefined || summary.pax !== undefined
    ? "legacy-alias"
    : "canonical";
}
