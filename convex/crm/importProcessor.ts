import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { logConvexApplicationError } from "../lib/observability";
import { resolveRoomCategory, resolveTravellerRoomFields } from "../lib/roomTypes";
import type { RuntimeObject, RuntimeValue } from "../lib/runtimeValues";
import { propertiesWhen } from "../lib/runtimeValues";
import { scheduleCrmMetricSync } from "./financeMetricSync";
import type { InternalPassengerImportRow } from "./importRows";
import { classifyImportError, publicImportErrorMessage } from "./importWorkerPolicy";
import { canSeeJobCardRecord, createActivity, type PortalAccess } from "./lib";
import { insertWithE2eOwnership, patchWithE2eOwnership } from "./lib/e2eOwnership";
import { buildTravellerListSearchText, markListSearchDirty } from "./listSearch";

export interface TravellerDoc {
  _id: Id<"travellers">;
  fullName: string;
  importKey?: string;
  jobCardId: Id<"jobCards">;
  visaStatus?: string;
  [key: string]: RuntimeValue;
}

export interface TravellerMatchIndex {
  byImportKey: Map<string, TravellerDoc>;
  byNormalizedName: Map<string, TravellerDoc>;
  byPassportHash: Map<string, TravellerDoc>;
}

interface TravellerMatchRow {
  fullName: string;
  importKey?: string;
  passportNumberHash?: string;
}

interface TravelBatchSelection {
  travelBatchId?: string;
  travelBatchReference?: string;
}

export async function getVisibleJob(
  ctx: QueryCtx,
  access: PortalAccess,
  jobCardId: Id<"jobCards">
) {
  const job = await ctx.db.get("jobCards", jobCardId);
  const linkedQuery = job?.queryId ? await ctx.db.get("queries", job.queryId) : null;
  if (!(job && canSeeJobCardRecord(access, job, linkedQuery))) {
    return null;
  }
  return job;
}

export async function buildTravellerMatchIndex(
  ctx: QueryCtx,
  jobCardId: Id<"jobCards">
): Promise<TravellerMatchIndex> {
  const sameJob = await ctx.db
    .query("travellers")
    .withIndex("by_jobCardId", (q) => q.eq("jobCardId", jobCardId))
    .collect();

  const byImportKey = new Map<string, TravellerDoc>();
  const byNormalizedName = new Map<string, TravellerDoc>();
  const byPassportHash = new Map<string, TravellerDoc>();

  for (const traveller of sameJob) {
    if (traveller.importKey) {
      byImportKey.set(traveller.importKey, traveller);
    }
    byNormalizedName.set(traveller.fullName.trim().toLowerCase(), traveller);
  }

  const passportRows = await Promise.all(
    sameJob.map((traveller: TravellerDoc) =>
      ctx.db
        .query("passportDetails")
        .withIndex("by_travellerId", (q) => q.eq("travellerId", traveller._id))
        .unique()
    )
  );
  for (let index = 0; index < sameJob.length; index += 1) {
    const passport = passportRows[index];
    if (passport?.passportNumberHash) {
      byPassportHash.set(passport.passportNumberHash, sameJob[index]);
    }
  }

  return { byImportKey, byNormalizedName, byPassportHash };
}

export function findTravellerMatchInIndex(
  index: TravellerMatchIndex,
  row: TravellerMatchRow
): TravellerDoc | null {
  if (row.passportNumberHash) {
    const byPassport = index.byPassportHash.get(row.passportNumberHash);
    if (byPassport) {
      return byPassport;
    }
  }
  if (row.importKey) {
    const byImportKey = index.byImportKey.get(row.importKey);
    if (byImportKey) {
      return byImportKey;
    }
  }
  return index.byNormalizedName.get(row.fullName.trim().toLowerCase()) ?? null;
}

export function summarizeRoomTypesFromRows(rows: Array<{ roomType?: string }>) {
  const summary: Record<string, number> = {};
  for (const row of rows) {
    const roomType = row.roomType?.trim();
    if (!roomType) {
      continue;
    }
    summary[roomType] = (summary[roomType] ?? 0) + 1;
  }
  return summary;
}

function registerTravellerInIndex(index: TravellerMatchIndex, traveller: TravellerDoc) {
  if (traveller.importKey) {
    index.byImportKey.set(traveller.importKey, traveller);
  }
  index.byNormalizedName.set(traveller.fullName.trim().toLowerCase(), traveller);
}

function includeText(value: string | undefined): value is string {
  return value !== undefined && value.trim() !== "";
}

export async function resolveImportTravelBatchId(
  ctx: QueryCtx,
  jobCardId: Id<"jobCards">,
  row: TravelBatchSelection
): Promise<Id<"travelBatches"> | undefined> {
  const rawId = String(row.travelBatchId ?? "").trim();
  if (rawId) {
    const travelBatchId = ctx.db.normalizeId("travelBatches", rawId);
    if (!travelBatchId) {
      throw new Error("Invalid Travel Batch id");
    }
    const batch = await ctx.db.get("travelBatches", travelBatchId);
    if (!batch || String(batch.jobCardId) !== String(jobCardId)) {
      throw new Error("Travel Batch must belong to the selected Job Card");
    }
    return travelBatchId;
  }

  const reference = String(row.travelBatchReference ?? "").trim();
  if (!reference) {
    return;
  }
  const batches = await ctx.db
    .query("travelBatches")
    .withIndex("by_jobCardId", (q) => q.eq("jobCardId", jobCardId))
    .collect();
  const normalizedReference = reference.toLowerCase();
  const match = batches.find((batch) =>
    [batch.batchReference, batch.batchCode]
      .filter(Boolean)
      .some((value) => String(value).trim().toLowerCase() === normalizedReference)
  );
  if (!match) {
    throw new Error(`Travel Batch not found for ${reference}`);
  }
  return match._id;
}

function ticketingEntries(row: InternalPassengerImportRow) {
  const ticketing = row.ticketing ?? {};
  return [
    {
      fare: String(ticketing.internationalFare ?? "").trim(),
      kind: "International",
      pnrCode: String(ticketing.internationalPnr ?? "").trim(),
      ticketNumber: "",
      vendor: String(ticketing.internationalVendor ?? "").trim(),
    },
    {
      fare: "",
      kind: "Domestic",
      pnrCode: String(ticketing.domesticPnr ?? "").trim(),
      ticketNumber: String(ticketing.domesticTicket ?? "").trim(),
      vendor: String(ticketing.domesticVendor ?? "").trim(),
    },
  ].filter((entry) => entry.pnrCode || entry.ticketNumber || entry.vendor || entry.fare);
}

async function findPnrByCode(ctx: MutationCtx, jobCardId: Id<"jobCards">, pnrCode: string) {
  const normalized = pnrCode.trim().toUpperCase();
  if (!normalized) {
    return null;
  }
  const rows = await ctx.db
    .query("pnrs")
    .withIndex("by_pnrCode", (q) => q.eq("pnrCode", normalized))
    .collect();
  return rows.find((row) => String(row.jobCardId) === String(jobCardId)) ?? null;
}

async function upsertTicketingPnr(
  ctx: MutationCtx,
  {
    jobCardId,
    entry,
    access,
    now,
  }: {
    jobCardId: Id<"jobCards">;
    entry: ReturnType<typeof ticketingEntries>[number];
    access: PortalAccess;
    now: number;
  }
) {
  if (!entry.pnrCode) {
    return null;
  }
  const existing = await findPnrByCode(ctx, jobCardId, entry.pnrCode);
  const fareType = entry.fare ? `${entry.kind} fare ${entry.fare}` : entry.kind;
  if (existing) {
    const patch: RuntimeObject = { updatedAt: now };
    if (!existing.airline && entry.vendor) {
      patch.airline = entry.vendor;
    }
    if (!existing.route) {
      patch.route = entry.kind;
    }
    if (!existing.fareType && fareType) {
      patch.fareType = fareType;
    }
    if (Object.keys(patch).length > 1) {
      await patchWithE2eOwnership(ctx, "pnrs", existing._id, patch, {
        authUserId: access.authUserId,
      });
      await scheduleCrmMetricSync(ctx, "pnrs", String(existing._id), {
        authUserId: access.authUserId,
      });
    }
    return existing;
  }

  const pnrId = await insertWithE2eOwnership(
    ctx,
    "pnrs",
    {
      airline: entry.vendor,
      createdAt: now,
      createdBy: access.authUserId ?? "unknown",
      fareType,
      issuedSeats: 0,
      jobCardId,
      pnrCode: entry.pnrCode.trim().toUpperCase(),
      route: entry.kind,
      status: "Active",
      totalSeats: 1,
      updatedAt: now,
    },
    { authUserId: access.authUserId }
  );
  await scheduleCrmMetricSync(ctx, "pnrs", String(pnrId), {
    authUserId: access.authUserId,
  });
  return await ctx.db.get("pnrs", pnrId);
}

async function upsertTicketingVendor(
  ctx: MutationCtx,
  {
    jobCardId,
    entry,
    access,
    now,
  }: {
    jobCardId: Id<"jobCards">;
    entry: ReturnType<typeof ticketingEntries>[number];
    access: PortalAccess;
    now: number;
  }
) {
  if (!entry.vendor) {
    return;
  }
  const rows = await ctx.db
    .query("vendors")
    .withIndex("by_jobCardId", (q) => q.eq("jobCardId", jobCardId))
    .collect();
  const type = `${entry.kind} Ticketing`;
  const existing = rows.find(
    (row) =>
      row.type.trim().toLowerCase() === type.toLowerCase() &&
      row.name.trim().toLowerCase() === entry.vendor.trim().toLowerCase()
  );
  if (existing) {
    await patchWithE2eOwnership(
      ctx,
      "vendors",
      existing._id,
      { updatedAt: now },
      { authUserId: access.authUserId }
    );
    return;
  }
  await insertWithE2eOwnership(
    ctx,
    "vendors",
    {
      contact: "",
      contractStatus: "",
      createdAt: now,
      createdBy: access.authUserId ?? "unknown",
      escalationMatrix: "",
      jobCardId,
      name: entry.vendor,
      notes: entry.pnrCode
        ? `Imported from ticketing PNR ${entry.pnrCode}`
        : "Imported ticketing vendor",
      paymentStatus: "",
      type,
      updatedAt: now,
    },
    { authUserId: access.authUserId }
  );
}

function groupTicketLookupKey(pnrId: Id<"pnrs"> | undefined, ticketNumber: string) {
  return `${String(pnrId ?? "")}|Group Ticket|${ticketNumber.trim().toLowerCase()}`;
}

function indexGroupTicketsByLookupKey(tickets: Doc<"tickets">[]) {
  const byKey = new Map<string, Doc<"tickets">>();
  for (const ticket of tickets) {
    if ((ticket.ticketType ?? "Group Ticket") !== "Group Ticket") {
      continue;
    }
    byKey.set(groupTicketLookupKey(ticket.pnrId, String(ticket.ticketNumber ?? "")), ticket);
  }
  return byKey;
}

async function patchPnrIssuedSeatsFromImport(
  ctx: MutationCtx,
  pnrKey: string,
  addedTickets: number,
  now: number,
  access: PortalAccess
) {
  // SAFETY: pnrKey is read from the canonical PNR ID map populated from pnrs table rows.
  const pnr = await ctx.db.get("pnrs", pnrKey as Id<"pnrs">);
  if (!pnr) {
    return;
  }
  const nextIssuedSeats = (pnr.issuedSeats ?? 0) + addedTickets;
  await patchWithE2eOwnership(
    ctx,
    "pnrs",
    pnr._id,
    {
      issuedSeats: nextIssuedSeats,
      totalSeats: Math.max(pnr.totalSeats ?? 0, nextIssuedSeats),
      updatedAt: now,
    },
    { authUserId: access.authUserId }
  );
  await scheduleCrmMetricSync(ctx, "pnrs", String(pnr._id), {
    authUserId: access.authUserId,
  });
}

async function upsertTicketingRowsForTraveller(
  ctx: MutationCtx,
  {
    jobCardId,
    travellerId,
    row,
    access,
    now,
  }: {
    jobCardId: Id<"jobCards">;
    travellerId: Id<"travellers">;
    row: InternalPassengerImportRow;
    access: PortalAccess;
    now: number;
  }
) {
  const entries = ticketingEntries(row);
  if (entries.length === 0) {
    return;
  }

  const existingTickets = await ctx.db
    .query("tickets")
    .withIndex("by_travellerId", (q) => q.eq("travellerId", travellerId))
    .collect();
  const ticketsByKey = indexGroupTicketsByLookupKey(existingTickets);
  const newTicketsByPnrId = new Map<string, number>();

  await Promise.all(
    entries.map(async (entry) => {
      const [pnr] = await Promise.all([
        upsertTicketingPnr(ctx, { access, entry, jobCardId, now }),
        upsertTicketingVendor(ctx, { access, entry, jobCardId, now }),
      ]);
      const pnrId = pnr?._id;
      const ticketKey = groupTicketLookupKey(pnrId, entry.ticketNumber);
      const existingTicket = ticketsByKey.get(ticketKey);
      if (existingTicket) {
        await patchWithE2eOwnership(
          ctx,
          "tickets",
          existingTicket._id,
          {
            cabinClass: "Economy",
            mealPreference: row.foodPreference,
            paymentType: row.paymentType,
            ticketStatus: "Issued",
            updatedAt: now,
          },
          { authUserId: access.authUserId }
        );
        await scheduleCrmMetricSync(ctx, "tickets", String(existingTicket._id), {
          authUserId: access.authUserId,
        });
        return;
      }

      const ticketId = await insertWithE2eOwnership(
        ctx,
        "tickets",
        {
          cabinClass: "Economy",
          createdAt: now,
          createdBy: access.authUserId ?? "unknown",
          jobCardId,
          mealPreference: row.foodPreference,
          paymentType: row.paymentType,
          pnrId: pnrId ?? undefined,
          seatNumber: "",
          seatPreference: "",
          ticketNumber: entry.ticketNumber,
          ticketStatus: "Issued",
          ticketType: "Group Ticket",
          travellerId,
          updatedAt: now,
        },
        { authUserId: access.authUserId }
      );
      await scheduleCrmMetricSync(ctx, "tickets", String(ticketId), {
        authUserId: access.authUserId,
      });

      if (pnr?._id) {
        const pnrKey = String(pnr._id);
        newTicketsByPnrId.set(pnrKey, (newTicketsByPnrId.get(pnrKey) ?? 0) + 1);
      }
    })
  );

  await Promise.all([
    ...[...newTicketsByPnrId.entries()].map(([pnrKey, addedTickets]) =>
      patchPnrIssuedSeatsFromImport(ctx, pnrKey, addedTickets, now, access)
    ),
    patchWithE2eOwnership(
      ctx,
      "travellers",
      travellerId,
      { ticketStatus: "Issued", updatedAt: now },
      { authUserId: access.authUserId }
    ),
  ]);
}

function trimmed(value: string | null | undefined, fallback = "") {
  return value?.trim() || fallback;
}

function visaStatusForImportRow(row: InternalPassengerImportRow): Doc<"visaRecords">["status"] {
  if (row.visaStatus) {
    return row.visaStatus;
  }
  return row.visaRequired ? "Not Started" : "Not Required";
}

function addImportSourceFields(patch: RuntimeObject, row: InternalPassengerImportRow) {
  patch.sourceDealerCode = trimmed(row.sourceDealerCode);
  patch.sourceDealerName = trimmed(row.sourceDealerName);
  patch.sourceDescription = trimmed(row.sourceDescription);
  patch.sourceSoName = trimmed(row.sourceSoName);
  patch.sourceRsoName = trimmed(row.sourceRsoName);
  patch.sourceGroup = trimmed(row.sourceGroup);
  patch.gender = trimmed(row.gender);
  patch.contactNo = trimmed(row.contactNo);
}

function addPassengerFields(patch: RuntimeObject, row: InternalPassengerImportRow) {
  patch.travelHub = trimmed(row.travelHub);
  patch.foodPreference = row.foodPreference;
  patch.guestType = row.guestType;
  patch.paymentType = row.paymentType;
  patch.roomType = resolveRoomCategory(row.roomType) ?? row.roomType;
  patch.visaRequired = row.visaRequired;
  patch.domesticTravelRequired = row.domesticTravelRequired ?? false;
  patch.passportStatus = trimmed(row.passportStatus, "Pending");
  patch.specialRequests = trimmed(row.specialRequests);
}

function addRoomingFields(patch: RuntimeObject, row: InternalPassengerImportRow) {
  const resolved = resolveTravellerRoomFields(row.roomType, row.hotelAllocation ?? row.roomType);
  if (resolved.roomType) {
    patch.roomType = resolved.roomType;
  }
  if (includeText(row.travelHub)) {
    patch.travelHub = row.travelHub.trim();
  }
  if (includeText(row.specialRequests)) {
    patch.specialRequests = row.specialRequests.trim();
  }
  if (resolved.hotelAllocation !== undefined) {
    patch.hotelAllocation = resolved.hotelAllocation;
  } else if (includeText(row.hotelAllocation)) {
    patch.hotelAllocation = row.hotelAllocation.trim();
  }
  if (includeText(row.passportStatus)) {
    patch.passportStatus = row.passportStatus.trim();
  }
}

function addPassportFields(patch: RuntimeObject, row: InternalPassengerImportRow) {
  if (includeText(row.passportStatus)) {
    patch.passportStatus = row.passportStatus.trim();
  }
}

function addVisaFields(patch: RuntimeObject, row: InternalPassengerImportRow) {
  patch.visaRequired = row.visaStatus ? row.visaStatus !== "Not Required" : row.visaRequired;
  patch.visaStatus = visaStatusForImportRow(row);
  if (includeText(row.biometricAppointmentDate)) {
    patch.biometricAppointmentDate = row.biometricAppointmentDate.trim();
  }
  if (includeText(row.paymentType)) {
    patch.paymentType = row.paymentType;
  }
  addPassportFields(patch, row);
}

function addKindSpecificTravellerFields(
  patch: RuntimeObject,
  row: InternalPassengerImportRow,
  importKind: string
) {
  if (importKind === "passenger" || importKind === "traveller") {
    addPassengerFields(patch, row);
    return;
  }
  if (importKind === "rooming") {
    addRoomingFields(patch, row);
    return;
  }
  if (importKind === "passport") {
    addPassportFields(patch, row);
    return;
  }
  if (importKind === "visa") {
    addVisaFields(patch, row);
  }
}

function travellerPatchForImport(
  row: InternalPassengerImportRow,
  job: Doc<"jobCards">,
  now: number,
  travelBatchId?: Id<"travelBatches">,
  travelBatch?: Doc<"travelBatches"> | null
) {
  const importKind = row.importKind ?? "passenger";
  const patch: RuntimeObject = {
    fullName: row.fullName.trim(),
    givenName: trimmed(row.givenName),
    importKey: row.importKey,
    importSource: `${importKind}-spreadsheet`,
    jobCardId: job._id,
    listSearchText: buildTravellerListSearchText(row, {
      jobCode: job.jobCode,
      travelBatchReference: travelBatch?.batchReference ?? row.travelBatchReference,
    }),
    sourceRowNumber: row.sourceRowNumber,
    sourceSheet: row.sourceSheet,
    surname: trimmed(row.surname),
    updatedAt: now,
  };
  if (row.travelBatchId !== undefined || row.travelBatchReference !== undefined) {
    patch.travelBatchId = travelBatchId;
    patch.travelBatchCode = travelBatch?.batchCode ?? "";
    patch.travelBatchReference = travelBatch?.batchReference ?? "";
  }
  addImportSourceFields(patch, row);
  addKindSpecificTravellerFields(patch, row, importKind);
  return patch;
}

function travellerCreateDefaults(
  row: InternalPassengerImportRow,
  job: Doc<"jobCards">,
  access: PortalAccess,
  now: number,
  travelBatchId?: Id<"travelBatches">,
  travelBatch?: Doc<"travelBatches"> | null
) {
  const visaStatus = visaStatusForImportRow(row);
  return {
    jobCardId: job._id,
    ...propertiesWhen(travelBatchId, () => ({ travelBatchId })),
    arrivingEarly: false,
    biometricAppointmentDate: trimmed(row.biometricAppointmentDate),
    callingStatus: "Pending" as const,
    cancellation: false,
    contactNo: trimmed(row.contactNo),
    createdAt: now,
    createdBy: access.authUserId ?? "unknown",
    domesticTravelRequired: row.domesticTravelRequired ?? false,
    extensionOfTour: false,
    foodPreference: row.foodPreference,
    fullName: row.fullName.trim(),
    gender: trimmed(row.gender),
    givenName: trimmed(row.givenName),
    guestCompanions: "",
    guestType: row.guestType,
    hasPassportScan: false,
    hotelAllocation: trimmed(row.hotelAllocation),
    importKey: row.importKey,
    importSource: `${row.importKind ?? "passenger"}-spreadsheet`,
    lastMinuteDrop: false,
    listSearchText: buildTravellerListSearchText(row, {
      jobCode: job.jobCode,
      travelBatchReference: travelBatch?.batchReference ?? row.travelBatchReference,
    }),
    passportStatus: trimmed(row.passportStatus, "Pending"),
    paymentType: row.paymentType,
    roomType: row.roomType,
    sourceDealerCode: trimmed(row.sourceDealerCode),
    sourceDealerName: trimmed(row.sourceDealerName),
    sourceDescription: trimmed(row.sourceDescription),
    sourceGroup: trimmed(row.sourceGroup),
    sourceRowNumber: row.sourceRowNumber,
    sourceRsoName: trimmed(row.sourceRsoName),
    sourceSheet: row.sourceSheet,
    sourceSoName: trimmed(row.sourceSoName),
    specialRequests: trimmed(row.specialRequests),
    surname: trimmed(row.surname),
    ticketStatus: "Pending Issue" as const,
    travelBatchCode: travelBatch?.batchCode ?? "",
    travelBatchReference: travelBatch?.batchReference ?? "",
    travelDate: job.travelStartDate ?? "",
    travelHub: trimmed(row.travelHub),
    updatedAt: now,
    visaRequired: row.visaStatus ? row.visaStatus !== "Not Required" : row.visaRequired,
    visaStatus,
  };
}

interface ImportedTravellerOutcome {
  committedTraveller: TravellerDoc;
  isNewTraveller: boolean;
  travellerId: Id<"travellers">;
}

interface ImportProcessingState {
  committedRows: InternalPassengerImportRow[];
  committedTravellerIds: Id<"travellers">[];
  created: number;
  errors: Array<{
    id: string;
    kind: "retryable" | "terminal";
    message: string;
    sourceRowNumber?: number;
    sourceSheet?: string;
  }>;
  failed: number;
  processed: number;
  rowResults: Array<{
    disposition: "created" | "failed" | "updated";
    fullName: string;
    id: string;
    message?: string;
    sourceRowNumber?: number;
    sourceSheet?: string;
  }>;
  updated: number;
}

function nextVisaRecordStatus(
  row: InternalPassengerImportRow,
  importKind: string,
  currentStatus: Doc<"visaRecords">["status"]
): Doc<"visaRecords">["status"] {
  if (importKind === "visa") {
    return visaStatusForImportRow(row);
  }
  if (!row.visaRequired) {
    return "Not Required";
  }
  return currentStatus === "Not Required" ? "Not Started" : currentStatus;
}

function nextTravellerVisaStatus(
  row: InternalPassengerImportRow,
  currentStatus: string | undefined
) {
  if (!row.visaRequired) {
    return "Not Required";
  }
  return currentStatus === "Not Required" ? "Not Started" : currentStatus;
}

async function upsertImportedVisaRecords(
  ctx: MutationCtx,
  {
    access,
    importKind,
    isNewTraveller,
    jobCardId,
    now,
    row,
    travellerId,
  }: {
    access: PortalAccess;
    importKind: string;
    isNewTraveller: boolean;
    jobCardId: Id<"jobCards">;
    now: number;
    row: InternalPassengerImportRow;
    travellerId: Id<"travellers">;
  }
) {
  if (!(isNewTraveller || importKind === "passenger" || importKind === "visa")) {
    return;
  }
  const visaRecords = await ctx.db
    .query("visaRecords")
    .withIndex("by_travellerId", (q) => q.eq("travellerId", travellerId))
    .collect();
  const authUserId = access.authUserId ?? "unknown";
  if (visaRecords.length === 0) {
    const visaRecordId = await insertWithE2eOwnership(
      ctx,
      "visaRecords",
      {
        appointmentDate: trimmed(row.biometricAppointmentDate),
        createdAt: now,
        jobCardId,
        notes: trimmed(row.visaNotes),
        status: visaStatusForImportRow(row),
        travellerId,
        updatedAt: now,
        updatedBy: authUserId,
      },
      { authUserId: access.authUserId }
    );
    await scheduleCrmMetricSync(ctx, "visaRecords", String(visaRecordId), {
      authUserId: access.authUserId,
    });
    return;
  }
  await Promise.all(
    visaRecords.map(async (visaRecord: Doc<"visaRecords">) => {
      await patchWithE2eOwnership(
        ctx,
        "visaRecords",
        visaRecord._id,
        {
          status: nextVisaRecordStatus(row, importKind, visaRecord.status),
          ...propertiesWhen(
            importKind === "visa" && row.biometricAppointmentDate !== undefined,
            () => ({ appointmentDate: trimmed(row.biometricAppointmentDate) })
          ),
          ...propertiesWhen(importKind === "visa" && row.visaNotes !== undefined, () => ({
            notes: trimmed(row.visaNotes),
          })),
          updatedAt: now,
          updatedBy: authUserId,
        },
        { authUserId: access.authUserId }
      );
      await scheduleCrmMetricSync(ctx, "visaRecords", String(visaRecord._id), {
        authUserId: access.authUserId,
      });
    })
  );
}

async function upsertImportedPassport(
  ctx: MutationCtx,
  {
    access,
    jobCardId,
    matchIndex,
    now,
    row,
    travellerId,
  }: {
    access: PortalAccess;
    jobCardId: Id<"jobCards">;
    matchIndex: TravellerMatchIndex;
    now: number;
    row: InternalPassengerImportRow;
    travellerId: Id<"travellers">;
  }
) {
  if (!row.encryptedPassportPayload) {
    return;
  }
  const existingPassport = await ctx.db
    .query("passportDetails")
    .withIndex("by_travellerId", (q) => q.eq("travellerId", travellerId))
    .unique();
  const passportPatch: RuntimeObject = {
    encryptedPayload: row.encryptedPassportPayload,
    lastFour: row.passportLastFour,
    passportNumberHash: row.passportNumberHash,
    status: "Received",
    updatedAt: now,
  };
  if (row.passportExpiryDate) {
    passportPatch.expiryDate = row.passportExpiryDate;
  }
  if (existingPassport) {
    await patchWithE2eOwnership(ctx, "passportDetails", existingPassport._id, passportPatch, {
      authUserId: access.authUserId,
    });
  } else {
    await insertWithE2eOwnership(
      ctx,
      "passportDetails",
      {
        createdAt: now,
        createdBy: access.authUserId ?? "unknown",
        encryptedPayload: row.encryptedPassportPayload,
        ...propertiesWhen(row.passportExpiryDate, () => ({
          expiryDate: row.passportExpiryDate,
        })),
        lastFour: row.passportLastFour,
        passportNumberHash: row.passportNumberHash,
        status: "Received",
        travellerId,
        updatedAt: now,
      },
      { authUserId: access.authUserId }
    );
  }
  if (row.passportNumberHash) {
    const travellerDoc = matchIndex.byImportKey.get(row.importKey) ??
      matchIndex.byNormalizedName.get(row.fullName.trim().toLowerCase()) ?? {
        _id: travellerId,
        fullName: row.fullName.trim(),
        importKey: row.importKey,
        jobCardId,
      };
    matchIndex.byPassportHash.set(row.passportNumberHash, travellerDoc);
  }
  await patchWithE2eOwnership(
    ctx,
    "travellers",
    travellerId,
    {
      passportExpiryDate: row.passportExpiryDate,
      passportStatus: "Received",
      updatedAt: now,
    },
    { authUserId: access.authUserId }
  );
}

async function saveImportedTraveller(
  ctx: MutationCtx,
  {
    access,
    job,
    jobCardId,
    matchIndex,
    now,
    row,
  }: {
    access: PortalAccess;
    job: Doc<"jobCards">;
    jobCardId: Id<"jobCards">;
    matchIndex: TravellerMatchIndex;
    now: number;
    row: InternalPassengerImportRow;
  }
): Promise<ImportedTravellerOutcome> {
  const match = findTravellerMatchInIndex(matchIndex, row);
  const importKind = row.importKind ?? "passenger";
  const travelBatchId = await resolveImportTravelBatchId(ctx, jobCardId, row);
  const travelBatch = travelBatchId ? await ctx.db.get("travelBatches", travelBatchId) : null;
  const travellerPatch = travellerPatchForImport(row, job, now, travelBatchId, travelBatch);
  let travellerId: Id<"travellers">;
  if (match) {
    const patch = { ...travellerPatch };
    if (importKind === "passenger") {
      patch.visaStatus = nextTravellerVisaStatus(row, match.visaStatus);
    }
    await patchWithE2eOwnership(ctx, "travellers", match._id, patch, {
      authUserId: access.authUserId,
    });
    travellerId = match._id;
  } else {
    travellerId = await insertWithE2eOwnership(
      ctx,
      "travellers",
      travellerCreateDefaults(row, job, access, now, travelBatchId, travelBatch),
      { authUserId: access.authUserId }
    );
  }
  const isNewTraveller = !match;
  await upsertImportedVisaRecords(ctx, {
    access,
    importKind,
    isNewTraveller,
    jobCardId,
    now,
    row,
    travellerId,
  });
  await upsertImportedPassport(ctx, {
    access,
    jobCardId,
    matchIndex,
    now,
    row,
    travellerId,
  });
  if (importKind === "passenger") {
    await upsertTicketingRowsForTraveller(ctx, {
      access,
      jobCardId,
      now,
      row,
      travellerId,
    });
  }
  await Promise.all([
    markListSearchDirty(ctx, "travellers", String(travellerId), {
      authUserId: access.authUserId,
    }),
    scheduleCrmMetricSync(ctx, "travellers", String(travellerId), {
      authUserId: access.authUserId,
    }),
  ]);
  const committedTraveller: TravellerDoc = match
    ? { ...match, ...travellerPatch, _id: match._id }
    : {
        _id: travellerId,
        fullName: row.fullName.trim(),
        importKey: row.importKey,
        jobCardId,
        visaStatus: row.visaStatus,
      };
  registerTravellerInIndex(matchIndex, committedTraveller);
  if (row.passportNumberHash) {
    matchIndex.byPassportHash.set(row.passportNumberHash, committedTraveller);
  }
  return { committedTraveller, isNewTraveller, travellerId };
}

function recordSuccessfulImport(
  state: ImportProcessingState,
  row: InternalPassengerImportRow,
  outcome: ImportedTravellerOutcome
) {
  if (outcome.isNewTraveller) {
    state.created += 1;
  } else {
    state.updated += 1;
  }
  state.processed += 1;
  state.committedRows.push(row);
  state.committedTravellerIds.push(outcome.travellerId);
  state.rowResults.push({
    disposition: outcome.isNewTraveller ? "created" : "updated",
    fullName: String(row.fullName ?? "").trim(),
    id: String(row.id ?? row.importKey ?? outcome.travellerId),
    sourceRowNumber: row.sourceRowNumber,
    sourceSheet: row.sourceSheet,
  });
}

function recordFailedImport(
  state: ImportProcessingState,
  row: InternalPassengerImportRow,
  error: Error
) {
  state.failed += 1;
  const kind = classifyImportError(error);
  if (kind === "terminal") {
    state.processed += 1;
  }
  const rowId = String(
    row.id ?? row.importKey ?? `${row.sourceSheet ?? "row"}:${row.sourceRowNumber ?? ""}`
  );
  const message = publicImportErrorMessage(error);
  state.errors.push({
    id: rowId,
    kind,
    message,
    sourceRowNumber: row.sourceRowNumber,
    sourceSheet: row.sourceSheet,
  });
  state.rowResults.push({
    disposition: "failed",
    fullName: String(row.fullName ?? "").trim(),
    id: rowId,
    message,
    sourceRowNumber: row.sourceRowNumber,
    sourceSheet: row.sourceSheet,
  });
  logConvexApplicationError("passenger_import_row_failure");
}

async function processAndRecordImportRow(
  ctx: MutationCtx,
  args: ProcessImportRowsArgs & { now: number },
  state: ImportProcessingState,
  row: InternalPassengerImportRow
) {
  try {
    const outcome = await saveImportedTraveller(ctx, {
      access: args.access,
      job: args.job,
      jobCardId: args.jobCardId,
      matchIndex: args.matchIndex,
      now: args.now,
      row,
    });
    recordSuccessfulImport(state, row, outcome);
  } catch (error) {
    if (args.failFast) {
      throw error;
    }
    recordFailedImport(state, row, error instanceof Error ? error : new Error(String(error)));
  }
}

interface ProcessImportRowsArgs {
  access: PortalAccess;
  failFast?: boolean;
  job: Doc<"jobCards">;
  jobCardId: Id<"jobCards">;
  logActivity?: boolean;
  matchIndex: TravellerMatchIndex;
  rows: InternalPassengerImportRow[];
}

export async function processImportRows(ctx: MutationCtx, args: ProcessImportRowsArgs) {
  const state: ImportProcessingState = {
    committedRows: [],
    committedTravellerIds: [],
    created: 0,
    errors: [],
    failed: 0,
    processed: 0,
    rowResults: [],
    updated: 0,
  };
  const now = Date.now();
  const { jobCardId, rows, access, job } = args;
  await rows.reduce<Promise<void>>(
    (previous, row) =>
      previous.then(() => processAndRecordImportRow(ctx, { ...args, now }, state, row)),
    Promise.resolve()
  );

  if (args.logActivity && rows.length > 0) {
    const importedKind = rows[0]?.importKind ?? "passenger";
    let importedLabel = `${importedKind} rows`;
    if (importedKind === "passenger") {
      importedLabel = "passengers";
    } else if (importedKind === "traveller") {
      importedLabel = "travellers";
    }

    await createActivity(ctx, access, {
      action: "imported",
      entityId: jobCardId,
      entityType: "traveller",
      message: `${state.created + state.updated} ${importedLabel} imported for ${job.jobCode}`,
    });
  }

  return {
    accepted: rows.length,
    committedTravellerIds: state.committedTravellerIds,
    created: state.created,
    errors: state.errors,
    failed: state.failed,
    processed: state.processed,
    remaining: rows.length - state.processed,
    roomSummary: summarizeRoomTypesFromRows(state.committedRows),
    rowResults: state.rowResults,
    total: rows.length,
    updated: state.updated,
  };
}
