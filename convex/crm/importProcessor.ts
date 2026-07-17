import type { Id } from "../_generated/dataModel";
import { resolveRoomCategory, resolveTravellerRoomFields } from "../lib/roomTypes";
import { classifyImportError, publicImportErrorMessage } from "./importWorkerPolicy";
import { canSeeJobCardRecord, createActivity } from "./lib";
import { buildTravellerListSearchText } from "./listSearch";

export type TravellerDoc = {
  _id: Id<"travellers">;
  jobCardId: Id<"jobCards">;
  fullName: string;
  importKey?: string;
  visaStatus?: string;
  [key: string]: unknown;
};

export type TravellerMatchIndex = {
  byImportKey: Map<string, TravellerDoc>;
  byNormalizedName: Map<string, TravellerDoc>;
  byPassportHash: Map<string, TravellerDoc>;
};

export async function getVisibleJob(ctx: any, access: any, jobCardId: Id<"jobCards">) {
  const job = await ctx.db.get(jobCardId);
  const linkedQuery = job?.queryId ? await ctx.db.get(job.queryId) : null;
  if (!(job && canSeeJobCardRecord(access, job, linkedQuery))) {
    return null;
  }
  return job;
}

export async function buildTravellerMatchIndex(
  ctx: any,
  jobCardId: Id<"jobCards">
): Promise<TravellerMatchIndex> {
  const sameJob = await ctx.db
    .query("travellers")
    .withIndex("by_jobCardId", (q: any) => q.eq("jobCardId", jobCardId))
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
        .withIndex("by_travellerId", (q: any) => q.eq("travellerId", traveller._id))
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
  row: any
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

function includeText(value: string | undefined) {
  return value !== undefined && value.trim() !== "";
}

export async function resolveImportTravelBatchId(
  ctx: any,
  jobCardId: Id<"jobCards">,
  row: any
): Promise<Id<"travelBatches"> | undefined> {
  const rawId = String(row.travelBatchId ?? "").trim();
  if (rawId) {
    const travelBatchId = ctx.db.normalizeId("travelBatches", rawId);
    if (!travelBatchId) {
      throw new Error("Invalid Travel Batch id");
    }
    const batch = await ctx.db.get(travelBatchId);
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
    .withIndex("by_jobCardId", (q: any) => q.eq("jobCardId", jobCardId))
    .collect();
  const normalizedReference = reference.toLowerCase();
  const match = batches.find((batch: any) =>
    [batch.batchReference, batch.batchCode]
      .filter(Boolean)
      .some((value) => String(value).trim().toLowerCase() === normalizedReference)
  );
  if (!match) {
    throw new Error(`Travel Batch not found for ${reference}`);
  }
  return match._id;
}

function ticketingEntries(row: any) {
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

async function findPnrByCode(ctx: any, jobCardId: Id<"jobCards">, pnrCode: string) {
  const normalized = pnrCode.trim().toUpperCase();
  if (!normalized) {
    return null;
  }
  const rows = await ctx.db
    .query("pnrs")
    .withIndex("by_pnrCode", (q: any) => q.eq("pnrCode", normalized))
    .collect();
  return rows.find((row: any) => String(row.jobCardId) === String(jobCardId)) ?? null;
}

async function upsertTicketingPnr(
  ctx: any,
  {
    jobCardId,
    entry,
    access,
    now,
  }: {
    jobCardId: Id<"jobCards">;
    entry: ReturnType<typeof ticketingEntries>[number];
    access: any;
    now: number;
  }
) {
  if (!entry.pnrCode) {
    return null;
  }
  const existing = await findPnrByCode(ctx, jobCardId, entry.pnrCode);
  const fareType = entry.fare ? `${entry.kind} fare ${entry.fare}` : entry.kind;
  if (existing) {
    const patch: Record<string, unknown> = { updatedAt: now };
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
      await ctx.db.patch(existing._id, patch);
    }
    return existing;
  }

  const pnrId = await ctx.db.insert("pnrs", {
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
  });
  return await ctx.db.get(pnrId);
}

async function upsertTicketingVendor(
  ctx: any,
  {
    jobCardId,
    entry,
    access,
    now,
  }: {
    jobCardId: Id<"jobCards">;
    entry: ReturnType<typeof ticketingEntries>[number];
    access: any;
    now: number;
  }
) {
  if (!entry.vendor) {
    return;
  }
  const rows = await ctx.db
    .query("vendors")
    .withIndex("by_jobCardId", (q: any) => q.eq("jobCardId", jobCardId))
    .collect();
  const type = `${entry.kind} Ticketing`;
  const existing = rows.find(
    (row: any) =>
      row.type.trim().toLowerCase() === type.toLowerCase() &&
      row.name.trim().toLowerCase() === entry.vendor.trim().toLowerCase()
  );
  if (existing) {
    await ctx.db.patch(existing._id, { updatedAt: now });
    return;
  }
  await ctx.db.insert("vendors", {
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
  });
}

function groupTicketLookupKey(pnrId: Id<"pnrs"> | undefined, ticketNumber: string) {
  return `${String(pnrId ?? "")}|Group Ticket|${ticketNumber.trim().toLowerCase()}`;
}

function indexGroupTicketsByLookupKey(tickets: Array<any>) {
  const byKey = new Map<string, any>();
  for (const ticket of tickets) {
    if ((ticket.ticketType ?? "Group Ticket") !== "Group Ticket") {
      continue;
    }
    byKey.set(groupTicketLookupKey(ticket.pnrId, String(ticket.ticketNumber ?? "")), ticket);
  }
  return byKey;
}

async function patchPnrIssuedSeatsFromImport(
  ctx: any,
  pnrKey: string,
  addedTickets: number,
  now: number
) {
  const pnr = await ctx.db.get(pnrKey as Id<"pnrs">);
  if (!pnr) {
    return;
  }
  const nextIssuedSeats = (pnr.issuedSeats ?? 0) + addedTickets;
  await ctx.db.patch(pnr._id, {
    issuedSeats: nextIssuedSeats,
    totalSeats: Math.max(pnr.totalSeats ?? 0, nextIssuedSeats),
    updatedAt: now,
  });
}

async function upsertTicketingRowsForTraveller(
  ctx: any,
  {
    jobCardId,
    travellerId,
    row,
    access,
    now,
  }: {
    jobCardId: Id<"jobCards">;
    travellerId: Id<"travellers">;
    row: any;
    access: any;
    now: number;
  }
) {
  const entries = ticketingEntries(row);
  if (entries.length === 0) {
    return;
  }

  const existingTickets = await ctx.db
    .query("tickets")
    .withIndex("by_travellerId", (q: any) => q.eq("travellerId", travellerId))
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
        await ctx.db.patch(existingTicket._id, {
          cabinClass: "Economy",
          mealPreference: row.foodPreference,
          paymentType: row.paymentType,
          ticketStatus: "Issued",
          updatedAt: now,
        });
        return;
      }

      await ctx.db.insert("tickets", {
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
      });

      if (pnr?._id) {
        const pnrKey = String(pnr._id);
        newTicketsByPnrId.set(pnrKey, (newTicketsByPnrId.get(pnrKey) ?? 0) + 1);
      }
    })
  );

  await Promise.all([
    ...[...newTicketsByPnrId.entries()].map(([pnrKey, addedTickets]) =>
      patchPnrIssuedSeatsFromImport(ctx, pnrKey, addedTickets, now)
    ),
    ctx.db.patch(travellerId, {
      ticketStatus: "Issued",
      updatedAt: now,
    }),
  ]);
}

function travellerPatchForImport(
  row: any,
  job: any,
  now: number,
  travelBatchId?: Id<"travelBatches">,
  travelBatch?: any
) {
  const importKind = row.importKind ?? "passenger";
  const patch: Record<string, unknown> = {
    fullName: row.fullName.trim(),
    givenName: row.givenName?.trim() || "",
    importKey: row.importKey,
    importSource: `${importKind}-spreadsheet`,
    jobCardId: job._id,
    listSearchText: buildTravellerListSearchText(row, {
      jobCode: job.jobCode,
      travelBatchReference: travelBatch?.batchReference ?? row.travelBatchReference,
    }),
    sourceRowNumber: row.sourceRowNumber,
    sourceSheet: row.sourceSheet,
    surname: row.surname?.trim() || "",
    updatedAt: now,
  };
  if (row.travelBatchId !== undefined || row.travelBatchReference !== undefined) {
    patch.travelBatchId = travelBatchId;
    patch.travelBatchCode = travelBatch?.batchCode ?? "";
    patch.travelBatchReference = travelBatch?.batchReference ?? "";
  }

  const includeSourceFields = () => {
    patch.sourceDealerCode = row.sourceDealerCode?.trim() || "";
    patch.sourceDealerName = row.sourceDealerName?.trim() || "";
    patch.sourceDescription = row.sourceDescription?.trim() || "";
    patch.sourceSoName = row.sourceSoName?.trim() || "";
    patch.sourceRsoName = row.sourceRsoName?.trim() || "";
    patch.sourceGroup = row.sourceGroup?.trim() || "";
    patch.gender = row.gender?.trim() || "";
    patch.contactNo = row.contactNo?.trim() || "";
  };

  includeSourceFields();

  if (importKind === "passenger" || importKind === "traveller") {
    patch.travelHub = row.travelHub?.trim() || "";
    patch.foodPreference = row.foodPreference;
    patch.guestType = row.guestType;
    patch.paymentType = row.paymentType;
    patch.roomType = resolveRoomCategory(row.roomType) ?? row.roomType;
    patch.visaRequired = row.visaRequired;
    patch.domesticTravelRequired = row.domesticTravelRequired ?? false;
    patch.passportStatus = row.passportStatus?.trim() || "Pending";
    patch.specialRequests = row.specialRequests?.trim() || "";
    return patch;
  }

  if (importKind === "rooming") {
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
    return patch;
  }

  if (importKind === "passport") {
    if (includeText(row.passportStatus)) {
      patch.passportStatus = row.passportStatus.trim();
    }
    return patch;
  }

  if (importKind === "visa") {
    patch.visaRequired = row.visaStatus ? row.visaStatus !== "Not Required" : row.visaRequired;
    patch.visaStatus = row.visaStatus || (row.visaRequired ? "Not Started" : "Not Required");
    if (includeText(row.biometricAppointmentDate)) {
      patch.biometricAppointmentDate = row.biometricAppointmentDate.trim();
    }
    if (includeText(row.paymentType)) {
      patch.paymentType = row.paymentType;
    }
    if (includeText(row.passportStatus)) {
      patch.passportStatus = row.passportStatus.trim();
    }
  }

  return patch;
}

function travellerCreateDefaults(
  row: any,
  job: any,
  access: any,
  now: number,
  travelBatchId?: Id<"travelBatches">,
  travelBatch?: any
) {
  const visaStatus = row.visaStatus || (row.visaRequired ? "Not Started" : "Not Required");
  return {
    jobCardId: job._id,
    ...(travelBatchId ? { travelBatchId } : {}),
    arrivingEarly: false,
    biometricAppointmentDate: row.biometricAppointmentDate?.trim() || "",
    callingStatus: "Pending" as const,
    cancellation: false,
    contactNo: row.contactNo?.trim() || "",
    createdAt: now,
    createdBy: access.authUserId ?? "unknown",
    domesticTravelRequired: row.domesticTravelRequired ?? false,
    extensionOfTour: false,
    foodPreference: row.foodPreference,
    fullName: row.fullName.trim(),
    gender: row.gender?.trim() || "",
    givenName: row.givenName?.trim() || "",
    guestCompanions: "",
    guestType: row.guestType,
    hasPassportScan: false,
    hotelAllocation: row.hotelAllocation?.trim() || "",
    importKey: row.importKey,
    importSource: `${row.importKind ?? "passenger"}-spreadsheet`,
    lastMinuteDrop: false,
    listSearchText: buildTravellerListSearchText(row, {
      jobCode: job.jobCode,
      travelBatchReference: travelBatch?.batchReference ?? row.travelBatchReference,
    }),
    passportStatus: row.passportStatus?.trim() || "Pending",
    paymentType: row.paymentType,
    roomType: row.roomType,
    sourceDealerCode: row.sourceDealerCode?.trim() || "",
    sourceDealerName: row.sourceDealerName?.trim() || "",
    sourceDescription: row.sourceDescription?.trim() || "",
    sourceGroup: row.sourceGroup?.trim() || "",
    sourceRowNumber: row.sourceRowNumber,
    sourceRsoName: row.sourceRsoName?.trim() || "",
    sourceSheet: row.sourceSheet,
    sourceSoName: row.sourceSoName?.trim() || "",
    specialRequests: row.specialRequests?.trim() || "",
    surname: row.surname?.trim() || "",
    ticketStatus: "Pending Issue" as const,
    travelBatchCode: travelBatch?.batchCode ?? "",
    travelBatchReference: travelBatch?.batchReference ?? "",
    travelDate: job.travelStartDate ?? "",
    travelHub: row.travelHub?.trim() || "",
    updatedAt: now,
    visaRequired: row.visaStatus ? row.visaStatus !== "Not Required" : row.visaRequired,
    visaStatus,
  };
}

export async function processImportRows(
  ctx: any,
  args: {
    jobCardId: Id<"jobCards">;
    rows: Array<any>;
    access: any;
    job: any;
    matchIndex: TravellerMatchIndex;
    logActivity?: boolean;
  }
) {
  let created = 0;
  let updated = 0;
  let failed = 0;
  let processed = 0;
  const errors: Array<{
    id: string;
    kind: "retryable" | "terminal";
    message: string;
    sourceRowNumber?: number;
    sourceSheet?: string;
  }> = [];
  const rowResults: Array<{
    disposition: "created" | "failed" | "updated";
    fullName: string;
    id: string;
    message?: string;
    sourceRowNumber?: number;
    sourceSheet?: string;
  }> = [];
  const now = Date.now();
  const { jobCardId, rows, access, job, matchIndex } = args;

  for (const row of rows) {
    try {
      const match = findTravellerMatchInIndex(matchIndex, row);
      const importKind = row.importKind ?? "passenger";
      const travelBatchId = await resolveImportTravelBatchId(ctx, jobCardId, row);
      const travelBatch = travelBatchId ? await ctx.db.get(travelBatchId) : null;
      const travellerPatch = travellerPatchForImport(row, job, now, travelBatchId, travelBatch);

      let travellerId: Id<"travellers">;
      let isNewTraveller = false;
      if (match) {
        const patch = { ...travellerPatch };
        if (importKind === "passenger") {
          patch.visaStatus =
            row.visaRequired && match.visaStatus === "Not Required"
              ? "Not Started"
              : row.visaRequired
                ? match.visaStatus
                : "Not Required";
        }
        await ctx.db.patch(match._id, patch);
        travellerId = match._id;
        updated += 1;
        registerTravellerInIndex(matchIndex, { ...match, ...patch, _id: match._id });
      } else {
        const newTraveller = travellerCreateDefaults(
          row,
          job,
          access,
          now,
          travelBatchId,
          travelBatch
        );
        travellerId = await ctx.db.insert("travellers", newTraveller);
        isNewTraveller = true;
        created += 1;
        registerTravellerInIndex(matchIndex, {
          _id: travellerId,
          fullName: newTraveller.fullName,
          importKey: newTraveller.importKey,
          jobCardId,
          visaStatus: newTraveller.visaStatus,
        });
        if (row.passportNumberHash) {
          matchIndex.byPassportHash.set(row.passportNumberHash, {
            _id: travellerId,
            fullName: newTraveller.fullName,
            importKey: newTraveller.importKey,
            jobCardId,
          });
        }
      }

      if (isNewTraveller || importKind === "passenger" || importKind === "visa") {
        const nextVisaStatus =
          row.visaStatus || (row.visaRequired ? "Not Started" : "Not Required");
        const visaRecords = await ctx.db
          .query("visaRecords")
          .withIndex("by_travellerId", (q: any) => q.eq("travellerId", travellerId))
          .collect();
        const authUserId = access.authUserId ?? "unknown";
        if (visaRecords.length === 0) {
          await ctx.db.insert("visaRecords", {
            appointmentDate: row.biometricAppointmentDate?.trim() || "",
            createdAt: now,
            jobCardId,
            notes: row.visaNotes?.trim() || "",
            status: nextVisaStatus,
            travellerId,
            updatedAt: now,
            updatedBy: authUserId,
          });
        } else {
          await Promise.all(
            visaRecords.map((visaRecord: { _id: Id<"visaRecords">; status: string }) => {
              const status =
                importKind === "visa"
                  ? nextVisaStatus
                  : row.visaRequired
                    ? visaRecord.status === "Not Required"
                      ? "Not Started"
                      : visaRecord.status
                    : "Not Required";
              return ctx.db.patch(visaRecord._id, {
                status,
                ...(importKind === "visa" && row.biometricAppointmentDate !== undefined
                  ? { appointmentDate: row.biometricAppointmentDate?.trim() || "" }
                  : {}),
                ...(importKind === "visa" && row.visaNotes !== undefined
                  ? { notes: row.visaNotes?.trim() || "" }
                  : {}),
                updatedAt: now,
                updatedBy: authUserId,
              });
            })
          );
        }
      }

      if (row.encryptedPassportPayload) {
        const existingPassport = await ctx.db
          .query("passportDetails")
          .withIndex("by_travellerId", (q: any) => q.eq("travellerId", travellerId))
          .unique();
        const passportPatch: Record<string, unknown> = {
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
          await ctx.db.patch(existingPassport._id, passportPatch);
        } else {
          await ctx.db.insert("passportDetails", {
            travellerId,
            ...passportPatch,
            createdAt: now,
            createdBy: access.authUserId ?? "unknown",
          });
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
        await ctx.db.patch(travellerId, {
          passportExpiryDate: row.passportExpiryDate,
          passportStatus: "Received",
          updatedAt: now,
        });
      }

      if (importKind === "passenger") {
        await upsertTicketingRowsForTraveller(ctx, {
          access,
          jobCardId,
          now,
          row,
          travellerId,
        });
      }
      processed += 1;
      rowResults.push({
        disposition: isNewTraveller ? "created" : "updated",
        fullName: String(row.fullName ?? "").trim(),
        id: String(row.id ?? row.importKey ?? travellerId),
        sourceRowNumber: row.sourceRowNumber,
        sourceSheet: row.sourceSheet,
      });
    } catch (error) {
      failed += 1;
      const kind = classifyImportError(error);
      if (kind === "terminal") {
        processed += 1;
      }
      const rowId = String(
        row.id ?? row.importKey ?? `${row.sourceSheet ?? "row"}:${row.sourceRowNumber ?? ""}`
      );
      errors.push({
        id: rowId,
        kind,
        message: publicImportErrorMessage(error),
        sourceRowNumber: row.sourceRowNumber,
        sourceSheet: row.sourceSheet,
      });
      rowResults.push({
        disposition: "failed",
        fullName: String(row.fullName ?? "").trim(),
        id: rowId,
        message: publicImportErrorMessage(error),
        sourceRowNumber: row.sourceRowNumber,
        sourceSheet: row.sourceSheet,
      });
      console.error("Import row failed:", error);
    }
  }

  if (args.logActivity && rows.length > 0) {
    const importedKind = rows[0]?.importKind ?? "passenger";
    const importedLabel =
      importedKind === "passenger"
        ? "passengers"
        : importedKind === "traveller"
          ? "travellers"
          : `${importedKind} rows`;

    await createActivity(ctx, access, {
      action: "imported",
      entityId: jobCardId,
      entityType: "traveller",
      message: `${created + updated} ${importedLabel} imported for ${job.jobCode}`,
    });
  }

  return {
    accepted: rows.length,
    created,
    errors,
    failed,
    processed,
    remaining: rows.length - processed,
    roomSummary: summarizeRoomTypesFromRows(rows),
    rowResults,
    total: rows.length,
    updated,
  };
}
