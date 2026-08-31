import type { Doc, Id } from "../_generated/dataModel";

const CONFIRMED_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function authoritativeConfirmedTimestamp(value: number | undefined) {
  return value !== undefined && Number.isFinite(value) && value >= 0 ? value : null;
}

export function normalizedConfirmedDate(value: string | undefined) {
  const normalized = value?.trim() ?? "";
  const match = CONFIRMED_DATE.exec(normalized);
  if (!match) {
    return null;
  }
  const timestamp = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const date = new Date(timestamp);
  return date.getUTCFullYear() === Number(match[1]) &&
    date.getUTCMonth() === Number(match[2]) - 1 &&
    date.getUTCDate() === Number(match[3])
    ? normalized
    : null;
}

/** One server-owned definition for the Confirmed travel summary readiness boundary. */
export function confirmedTravelSummaryProjection(input: {
  handoff: Doc<"proposalQueryHandoffs"> | null;
  offer: Doc<"confirmedOffers">;
  queryId: Id<"queries">;
}) {
  const { handoff, offer, queryId } = input;
  const confirmedAt = authoritativeConfirmedTimestamp(offer.confirmedAt);
  const destination = offer.destination?.trim() || null;
  const startDate = normalizedConfirmedDate(offer.travelStartDate);
  const endDate = normalizedConfirmedDate(offer.travelEndDate);
  const exactHandoff = Boolean(
    handoff &&
      handoff.proposalId === offer.proposalId &&
      handoff.queryId === queryId &&
      Number.isSafeInteger(offer.proposalRevision) &&
      Number(offer.proposalRevision) > 0 &&
      handoff.proposalRevision === offer.proposalRevision
  );
  const ready = Boolean(
    confirmedAt !== null &&
      exactHandoff &&
      destination &&
      startDate &&
      endDate &&
      startDate <= endDate
  );
  return {
    asOf: ready ? confirmedAt : null,
    destination,
    endDate,
    startDate,
  };
}
