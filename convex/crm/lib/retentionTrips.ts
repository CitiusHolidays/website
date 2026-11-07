import type { Doc, Id } from "../../_generated/dataModel";
import type { QueryCtx } from "../../_generated/server";
import { jobCardTripEndDate, tripDates, tripEndDate } from "./retentionSchedule";

/** A Job Card with more batches than this is treated as undated rather than read unbounded. */
const MAX_BATCHES_PER_JOB_CARD = 200;

/**
 * Trip end lookups for one retention page, memoized so travellers on the same Job Card or
 * Travel Batch read it once. Returns `null` for an undated trip and `"missing"` when the Job
 * Card no longer exists.
 */
export function tripEndLookup(ctx: QueryCtx) {
  const jobs = new Map<string, Promise<Doc<"jobCards"> | null>>();
  const batches = new Map<string, Promise<Doc<"travelBatches"> | null>>();
  const jobEnds = new Map<string, Promise<string | null | "missing">>();

  const job = (id: Id<"jobCards">) => {
    let pending = jobs.get(id);
    if (!pending) {
      pending = ctx.db.get("jobCards", id);
      jobs.set(id, pending);
    }
    return pending;
  };
  const batch = (id: Id<"travelBatches">) => {
    let pending = batches.get(id);
    if (!pending) {
      pending = ctx.db.get("travelBatches", id);
      batches.set(id, pending);
    }
    return pending;
  };

  async function forTraveller(traveller: Doc<"travellers">) {
    const jobCard = await job(traveller.jobCardId);
    if (!jobCard) {
      return "missing" as const;
    }
    const travelBatch = traveller.travelBatchId ? await batch(traveller.travelBatchId) : null;
    return tripEndDate(tripDates(jobCard, travelBatch));
  }

  async function loadJobCardEnd(id: Id<"jobCards">) {
    const jobCard = await job(id);
    if (!jobCard) {
      return "missing" as const;
    }
    const rows = await ctx.db
      .query("travelBatches")
      .withIndex("by_jobCardId", (q) => q.eq("jobCardId", id))
      .take(MAX_BATCHES_PER_JOB_CARD + 1);
    return rows.length > MAX_BATCHES_PER_JOB_CARD ? null : jobCardTripEndDate(jobCard, rows);
  }

  function forJobCard(id: Id<"jobCards">) {
    let pending = jobEnds.get(id);
    if (!pending) {
      pending = loadJobCardEnd(id);
      jobEnds.set(id, pending);
    }
    return pending;
  }

  return { forJobCard, forTraveller };
}
