import { makeFunctionReference } from "convex/server";
import type { Doc } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { internalMutation, internalQuery } from "../../_generated/server";
import { invalidateDocumentPreviewSource } from "../documentPreviewLifecycle";
import { scheduleCrmMetricSync } from "../financeMetricSync";
import { deleteEntityNotifications } from "../lib/notifications";
import {
  deleteStorageWhenUnreferenced,
  type RetentionDecision,
  type RetentionPlan,
  reportRetentionPage,
  retentionContinuationArgs,
  retentionReportArgs,
  retentionReportResult,
  retentionRunResult,
  runRetentionPage,
} from "../lib/retentionRun";
import { RETENTION_PERIODS, retentionCutoff, tripRetentionVerdict } from "../lib/retentionSchedule";
import { tripEndLookup } from "../lib/retentionTrips";
import { buildTravellerListSearchText, markListSearchDirty } from "../listSearch";

/**
 * Traveller records (director decision, 7 Nov 2026) are anonymised three years after the trip
 * ends, never deleted: the row stays so the Job Card's passenger, room and meal counts, tickets,
 * visa outcomes and invoices still add up. The name becomes a placeholder; contact details,
 * gender, special requests, companions, hotel allocation, the traveller's own guardian links,
 * minor flag, import names and notes are removed; passport details and scans still left are
 * deleted; meal preference rows are deleted; rooming, seat and visa notes are cleared.
 *
 * `foodPreference` and `roomType` are required fields that feed the Job Card's meal and room
 * counts, so they stay; without a name or contact they no longer identify anyone. A minor whose
 * own trip is not yet past the period keeps its link to an anonymised guardian until the minor's
 * own turn. Tickets keep
 * their number (a financial reference). `retentionAnonymisedAt` marks a finished traveller.
 * Run by `jobs.anonymise_past_travellers`, which is off until the owner switches it on.
 */
export const ANONYMISED_TRAVELLER_NAME = "Anonymised traveller";
const PAGE_SIZE = 25;
const DEPENDENT_LIMIT = 32;

const continuePurgeRef = makeFunctionReference<"mutation", { asOf: number; cursor: string }>(
  "crm/retention/travellers:continuePurge"
);

/** Strips dependent rows; false when a table had more rows than one pass handles. */
async function stripDependents(ctx: MutationCtx, traveller: Doc<"travellers">) {
  const [passports, meals, rooming, seats, visas] = await Promise.all([
    ctx.db
      .query("passportDetails")
      .withIndex("by_travellerId", (q) => q.eq("travellerId", traveller._id))
      .take(DEPENDENT_LIMIT),
    ctx.db
      .query("mealPreferences")
      .withIndex("by_travellerId", (q) => q.eq("travellerId", traveller._id))
      .take(DEPENDENT_LIMIT),
    ctx.db
      .query("roomingListEntries")
      .withIndex("by_travellerId", (q) => q.eq("travellerId", traveller._id))
      .take(DEPENDENT_LIMIT),
    ctx.db
      .query("seatAllocations")
      .withIndex("by_travellerId", (q) => q.eq("travellerId", traveller._id))
      .take(DEPENDENT_LIMIT),
    ctx.db
      .query("visaRecords")
      .withIndex("by_travellerId", (q) => q.eq("travellerId", traveller._id))
      .take(DEPENDENT_LIMIT),
  ]);
  await Promise.all([
    ...passports.map(async (passport) => {
      await invalidateDocumentPreviewSource(ctx, "passport", String(traveller._id));
      await ctx.db.delete("passportDetails", passport._id);
      await deleteStorageWhenUnreferenced(ctx, passport.storageId);
    }),
    ...meals.map((meal) => ctx.db.delete("mealPreferences", meal._id)),
    ...rooming.map((entry) =>
      ctx.db.patch("roomingListEntries", entry._id, { notes: undefined, sharingWith: undefined })
    ),
    ...seats.map((seat) => ctx.db.patch("seatAllocations", seat._id, { notes: undefined })),
    ...visas.map((visa) => ctx.db.patch("visaRecords", visa._id, { notes: undefined })),
  ]);
  return [passports, meals, rooming, seats, visas].every((rows) => rows.length < DEPENDENT_LIMIT);
}

async function anonymiseTraveller(ctx: MutationCtx, traveller: Doc<"travellers">) {
  // The Job Card is only read for its code; stripping dependents never touches it.
  const [complete, job] = await Promise.all([
    stripDependents(ctx, traveller),
    ctx.db.get("jobCards", traveller.jobCardId),
  ]);
  const now = Date.now();
  const patch = {
    biometricAppointmentDate: undefined,
    contactNo: undefined,
    email: undefined,
    firstGuardianTravellerId: undefined,
    fullName: ANONYMISED_TRAVELLER_NAME,
    gender: undefined,
    givenName: undefined,
    guardianImportReferences: undefined,
    guestCompanions: undefined,
    hasPassportScan: false,
    hotelAllocation: undefined,
    importKey: undefined,
    isMinor: undefined,
    marketingConsentNote: undefined,
    passportExpiryDate: undefined,
    retentionAnonymisedAt: complete ? now : undefined,
    secondGuardianTravellerId: undefined,
    sourceDealerName: undefined,
    sourceDescription: undefined,
    sourceRsoName: undefined,
    sourceSoName: undefined,
    specialRequests: undefined,
    surname: undefined,
    updatedAt: now,
  };
  await ctx.db.patch("travellers", traveller._id, {
    ...patch,
    listSearchText: buildTravellerListSearchText(
      { ...traveller, ...patch },
      { jobCode: job?.jobCode, travelBatchReference: traveller.travelBatchReference }
    ),
  });
  await deleteEntityNotifications(ctx, "traveller", String(traveller._id));
  await markListSearchDirty(ctx, "travellers", String(traveller._id));
  await scheduleCrmMetricSync(ctx, "travellers", String(traveller._id));
}

async function plan(ctx: QueryCtx, asOf: number, cursor: string | null): Promise<RetentionPlan> {
  const cutoff = retentionCutoff(asOf, RETENTION_PERIODS.travellersAfterTrip);
  const trips = tripEndLookup(ctx);
  const page = await ctx.db.query("travellers").paginate({ cursor, numItems: PAGE_SIZE });
  const decisions = await Promise.all(
    page.page.map(async (traveller): Promise<RetentionDecision> => {
      if (traveller.retentionAnonymisedAt !== undefined) {
        return { outcome: "already_anonymised" };
      }
      const end = await trips.forTraveller(traveller);
      if (end === "missing") {
        return { outcome: "kept_no_job_card" };
      }
      const verdict = tripRetentionVerdict(end, cutoff);
      if (verdict !== "expired") {
        return { outcome: verdict };
      }
      return {
        // Re-read the row at apply time; the plan may have been made from an older read.
        apply: async (writer) => {
          const current = await writer.db.get("travellers", traveller._id);
          if (current) {
            await anonymiseTraveller(writer, current);
          }
        },
        outcome: "anonymised",
      };
    })
  );
  return { continueCursor: page.isDone ? null : page.continueCursor, decisions };
}

const JOB = {
  continueRef: continuePurgeRef,
  controlKey: "jobs.anonymise_past_travellers",
  planner: plan,
} as const;

/** Entrypoint dispatched by the `jobs.anonymise_past_travellers` scheduled job. */
export const purgeExpired = internalMutation({
  args: {},
  handler: async (ctx) => await runRetentionPage(ctx, JOB, Date.now(), null),
  returns: retentionRunResult,
});

/** Continues one run in a fresh transaction with the run's fixed `asOf`. */
export const continuePurge = internalMutation({
  args: retentionContinuationArgs,
  handler: async (ctx, args) => await runRetentionPage(ctx, JOB, args.asOf, args.cursor),
  returns: retentionRunResult,
});

/** Dry run: what one page of the job would do at `asOf`, as content-free counts. */
export const dryRun = internalQuery({
  args: retentionReportArgs,
  handler: async (ctx, args) =>
    await reportRetentionPage(args.secret, () => plan(ctx, args.asOf, args.cursor)),
  returns: retentionReportResult,
});
