import type { Id } from "../_generated/dataModel";
import { resolveRoomCategory, resolveTravellerRoomFields } from "../lib/roomTypes";
import { canSeeJobCardRecord, createActivity } from "./lib";

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
  if (!job || !canSeeJobCardRecord(access, job, linkedQuery)) {
    return null;
  }
  return job;
}

export async function buildTravellerMatchIndex(
  ctx: any,
  jobCardId: Id<"jobCards">,
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
        .unique(),
    ),
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
  row: any,
): TravellerDoc | null {
  if (row.passportNumberHash) {
    const byPassport = index.byPassportHash.get(row.passportNumberHash);
    if (byPassport) return byPassport;
  }
  if (row.importKey) {
    const byImportKey = index.byImportKey.get(row.importKey);
    if (byImportKey) return byImportKey;
  }
  return index.byNormalizedName.get(row.fullName.trim().toLowerCase()) ?? null;
}

export function summarizeRoomTypesFromRows(rows: Array<{ roomType?: string }>) {
  const summary: Record<string, number> = {};
  for (const row of rows) {
    const roomType = row.roomType?.trim();
    if (!roomType) continue;
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

function ticketingEntries(row: any) {
  const ticketing = row.ticketing ?? {};
  return [
    {
      kind: "International",
      pnrCode: String(ticketing.internationalPnr ?? "").trim(),
      ticketNumber: "",
      vendor: String(ticketing.internationalVendor ?? "").trim(),
      fare: String(ticketing.internationalFare ?? "").trim(),
    },
    {
      kind: "Domestic",
      pnrCode: String(ticketing.domesticPnr ?? "").trim(),
      ticketNumber: String(ticketing.domesticTicket ?? "").trim(),
      vendor: String(ticketing.domesticVendor ?? "").trim(),
      fare: "",
    },
  ].filter((entry) => entry.pnrCode || entry.ticketNumber || entry.vendor || entry.fare);
}

async function findPnrByCode(ctx: any, jobCardId: Id<"jobCards">, pnrCode: string) {
  const normalized = pnrCode.trim().toUpperCase();
  if (!normalized) return null;
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
  },
) {
  if (!entry.pnrCode) return null;
  const existing = await findPnrByCode(ctx, jobCardId, entry.pnrCode);
  const fareType = entry.fare ? `${entry.kind} fare ${entry.fare}` : entry.kind;
  if (existing) {
    const patch: Record<string, unknown> = { updatedAt: now };
    if (!existing.airline && entry.vendor) patch.airline = entry.vendor;
    if (!existing.route) patch.route = entry.kind;
    if (!existing.fareType && fareType) patch.fareType = fareType;
    if (Object.keys(patch).length > 1) await ctx.db.patch(existing._id, patch);
    return existing;
  }

  const pnrId = await ctx.db.insert("pnrs", {
    jobCardId,
    pnrCode: entry.pnrCode.trim().toUpperCase(),
    airline: entry.vendor,
    route: entry.kind,
    fareType,
    status: "Active",
    totalSeats: 1,
    issuedSeats: 0,
    createdBy: access.authUserId ?? "unknown",
    createdAt: now,
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
  },
) {
  if (!entry.vendor) return;
  const rows = await ctx.db
    .query("vendors")
    .withIndex("by_jobCardId", (q: any) => q.eq("jobCardId", jobCardId))
    .collect();
  const type = `${entry.kind} Ticketing`;
  const existing = rows.find(
    (row: any) =>
      row.type.trim().toLowerCase() === type.toLowerCase() &&
      row.name.trim().toLowerCase() === entry.vendor.trim().toLowerCase(),
  );
  if (existing) {
    await ctx.db.patch(existing._id, { updatedAt: now });
    return;
  }
  await ctx.db.insert("vendors", {
    jobCardId,
    type,
    name: entry.vendor,
    contact: "",
    contractStatus: "",
    paymentStatus: "",
    escalationMatrix: "",
    notes: entry.pnrCode
      ? `Imported from ticketing PNR ${entry.pnrCode}`
      : "Imported ticketing vendor",
    createdBy: access.authUserId ?? "unknown",
    createdAt: now,
    updatedAt: now,
  });
}

function groupTicketLookupKey(pnrId: Id<"pnrs"> | undefined, ticketNumber: string) {
  return `${String(pnrId ?? "")}|Group Ticket|${ticketNumber.trim().toLowerCase()}`;
}

function indexGroupTicketsByLookupKey(tickets: Array<any>) {
  const byKey = new Map<string, any>();
  for (const ticket of tickets) {
    if ((ticket.ticketType ?? "Group Ticket") !== "Group Ticket") continue;
    byKey.set(groupTicketLookupKey(ticket.pnrId, String(ticket.ticketNumber ?? "")), ticket);
  }
  return byKey;
}

async function patchPnrIssuedSeatsFromImport(
  ctx: any,
  pnrKey: string,
  addedTickets: number,
  now: number,
) {
  const pnr = await ctx.db.get(pnrKey as Id<"pnrs">);
  if (!pnr) return;
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
  },
) {
  const entries = ticketingEntries(row);
  if (entries.length === 0) return;

  const existingTickets = await ctx.db
    .query("tickets")
    .withIndex("by_travellerId", (q: any) => q.eq("travellerId", travellerId))
    .collect();
  const ticketsByKey = indexGroupTicketsByLookupKey(existingTickets);
  const newTicketsByPnrId = new Map<string, number>();

  await Promise.all(
    entries.map(async (entry) => {
      const [pnr] = await Promise.all([
        upsertTicketingPnr(ctx, { jobCardId, entry, access, now }),
        upsertTicketingVendor(ctx, { jobCardId, entry, access, now }),
      ]);
      const pnrId = pnr?._id;
      const ticketKey = groupTicketLookupKey(pnrId, entry.ticketNumber);
      const existingTicket = ticketsByKey.get(ticketKey);
      if (existingTicket) {
        await ctx.db.patch(existingTicket._id, {
          ticketStatus: "Issued",
          paymentType: row.paymentType,
          cabinClass: "Economy",
          mealPreference: row.foodPreference,
          updatedAt: now,
        });
        return;
      }

      await ctx.db.insert("tickets", {
        jobCardId,
        travellerId,
        pnrId: pnrId ?? undefined,
        ticketNumber: entry.ticketNumber,
        ticketType: "Group Ticket",
        ticketStatus: "Issued",
        paymentType: row.paymentType,
        cabinClass: "Economy",
        mealPreference: row.foodPreference,
        seatPreference: "",
        seatNumber: "",
        createdBy: access.authUserId ?? "unknown",
        createdAt: now,
        updatedAt: now,
      });

      if (pnr?._id) {
        const pnrKey = String(pnr._id);
        newTicketsByPnrId.set(pnrKey, (newTicketsByPnrId.get(pnrKey) ?? 0) + 1);
      }
    }),
  );

  await Promise.all([
    ...[...newTicketsByPnrId.entries()].map(([pnrKey, addedTickets]) =>
      patchPnrIssuedSeatsFromImport(ctx, pnrKey, addedTickets, now),
    ),
    ctx.db.patch(travellerId, {
      ticketStatus: "Issued",
      updatedAt: now,
    }),
  ]);
}

function travellerPatchForImport(row: any, job: any, now: number) {
  const importKind = row.importKind ?? "passenger";
  const patch: Record<string, unknown> = {
    jobCardId: job._id,
    fullName: row.fullName.trim(),
    surname: row.surname?.trim() || "",
    givenName: row.givenName?.trim() || "",
    importSource: `${importKind}-spreadsheet`,
    importKey: row.importKey,
    sourceSheet: row.sourceSheet,
    sourceRowNumber: row.sourceRowNumber,
    updatedAt: now,
  };

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
    const resolved = resolveTravellerRoomFields(
      row.roomType,
      row.hotelAllocation ?? row.roomType,
    );
    if (resolved.roomType) {
      patch.roomType = resolved.roomType;
    }
    if (includeText(row.travelHub)) patch.travelHub = row.travelHub.trim();
    if (includeText(row.specialRequests)) patch.specialRequests = row.specialRequests.trim();
    if (resolved.hotelAllocation !== undefined) {
      patch.hotelAllocation = resolved.hotelAllocation;
    } else if (includeText(row.hotelAllocation)) {
      patch.hotelAllocation = row.hotelAllocation.trim();
    }
    if (includeText(row.passportStatus)) patch.passportStatus = row.passportStatus.trim();
    return patch;
  }

  if (importKind === "passport") {
    if (includeText(row.passportStatus)) patch.passportStatus = row.passportStatus.trim();
    return patch;
  }

  if (importKind === "visa") {
    patch.visaRequired = row.visaStatus ? row.visaStatus !== "Not Required" : row.visaRequired;
    patch.visaStatus = row.visaStatus || (row.visaRequired ? "Not Started" : "Not Required");
    if (includeText(row.biometricAppointmentDate)) {
      patch.biometricAppointmentDate = row.biometricAppointmentDate.trim();
    }
    if (includeText(row.paymentType)) patch.paymentType = row.paymentType;
    if (includeText(row.passportStatus)) patch.passportStatus = row.passportStatus.trim();
  }

  return patch;
}

function travellerCreateDefaults(row: any, job: any, access: any, now: number) {
  const visaStatus = row.visaStatus || (row.visaRequired ? "Not Started" : "Not Required");
  return {
    jobCardId: job._id,
    fullName: row.fullName.trim(),
    surname: row.surname?.trim() || "",
    givenName: row.givenName?.trim() || "",
    travelHub: row.travelHub?.trim() || "",
    foodPreference: row.foodPreference,
    guestType: row.guestType,
    paymentType: row.paymentType,
    roomType: row.roomType,
    visaRequired: row.visaStatus ? row.visaStatus !== "Not Required" : row.visaRequired,
    domesticTravelRequired: row.domesticTravelRequired ?? false,
    passportStatus: row.passportStatus?.trim() || "Pending",
    specialRequests: row.specialRequests?.trim() || "",
    hotelAllocation: row.hotelAllocation?.trim() || "",
    gender: row.gender?.trim() || "",
    contactNo: row.contactNo?.trim() || "",
    importSource: `${row.importKind ?? "passenger"}-spreadsheet`,
    importKey: row.importKey,
    sourceSheet: row.sourceSheet,
    sourceRowNumber: row.sourceRowNumber,
    sourceDealerCode: row.sourceDealerCode?.trim() || "",
    sourceDealerName: row.sourceDealerName?.trim() || "",
    sourceDescription: row.sourceDescription?.trim() || "",
    sourceSoName: row.sourceSoName?.trim() || "",
    sourceRsoName: row.sourceRsoName?.trim() || "",
    sourceGroup: row.sourceGroup?.trim() || "",
    biometricAppointmentDate: row.biometricAppointmentDate?.trim() || "",
    travelDate: job.travelStartDate ?? "",
    extensionOfTour: false,
    arrivingEarly: false,
    guestCompanions: "",
    ticketStatus: "Pending Issue" as const,
    visaStatus,
    callingStatus: "Pending" as const,
    cancellation: false,
    lastMinuteDrop: false,
    createdBy: access.authUserId ?? "unknown",
    createdAt: now,
    updatedAt: now,
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
  },
) {
  let created = 0;
  let updated = 0;
  let failed = 0;
  const now = Date.now();
  const { jobCardId, rows, access, job, matchIndex } = args;

  for (const row of rows) {
    try {
      const match = findTravellerMatchInIndex(matchIndex, row);
      const importKind = row.importKind ?? "passenger";
      const travellerPatch = travellerPatchForImport(row, job, now);

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
        const newTraveller = travellerCreateDefaults(row, job, access, now);
        travellerId = await ctx.db.insert("travellers", newTraveller);
        isNewTraveller = true;
        created += 1;
        registerTravellerInIndex(matchIndex, {
          _id: travellerId,
          jobCardId,
          fullName: newTraveller.fullName,
          importKey: newTraveller.importKey,
          visaStatus: newTraveller.visaStatus,
        });
        if (row.passportNumberHash) {
          matchIndex.byPassportHash.set(row.passportNumberHash, {
            _id: travellerId,
            jobCardId,
            fullName: newTraveller.fullName,
            importKey: newTraveller.importKey,
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
            travellerId,
            jobCardId,
            status: nextVisaStatus,
            appointmentDate: row.biometricAppointmentDate?.trim() || "",
            notes: row.visaNotes?.trim() || "",
            updatedBy: authUserId,
            createdAt: now,
            updatedAt: now,
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
                updatedBy: authUserId,
                updatedAt: now,
              });
            }),
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
            createdBy: access.authUserId ?? "unknown",
            createdAt: now,
          });
        }
        if (row.passportNumberHash) {
          const travellerDoc = matchIndex.byImportKey.get(row.importKey) ??
            matchIndex.byNormalizedName.get(row.fullName.trim().toLowerCase()) ?? {
              _id: travellerId,
              jobCardId,
              fullName: row.fullName.trim(),
              importKey: row.importKey,
            };
          matchIndex.byPassportHash.set(row.passportNumberHash, travellerDoc);
        }
        await ctx.db.patch(travellerId, {
          passportStatus: "Received",
          updatedAt: now,
        });
      }

      if (importKind === "passenger") {
        await upsertTicketingRowsForTraveller(ctx, {
          jobCardId,
          travellerId,
          row,
          access,
          now,
        });
      }
    } catch (error) {
      failed += 1;
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
      entityType: "traveller",
      entityId: jobCardId,
      action: "imported",
      message: `${created + updated} ${importedLabel} imported for ${job.jobCode}`,
    });
  }

  return {
    created,
    updated,
    failed,
    total: rows.length,
    roomSummary: summarizeRoomTypesFromRows(rows),
  };
}
