import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { internalMutation, internalQuery, mutation, query } from "../_generated/server";
import { canSeeJobCardRecord, createActivity, PERMISSIONS, requireStaff } from "./lib";

const foodPreferenceValidator = v.union(
  v.literal("Veg"),
  v.literal("Non-Veg"),
  v.literal("Jain"),
  v.literal("Vegan"),
);

const importKindValidator = v.union(
  v.literal("passenger"),
  v.literal("traveller"),
  v.literal("rooming"),
  v.literal("passport"),
  v.literal("visa"),
);

const visaStatusValidator = v.union(
  v.literal("Not Required"),
  v.literal("Not Started"),
  v.literal("Checklist Shared"),
  v.literal("Documents Pending"),
  v.literal("Documents Verified"),
  v.literal("Appointment Scheduled"),
  v.literal("Submitted"),
  v.literal("Awaiting"),
  v.literal("Approved"),
  v.literal("Rejected"),
  v.literal("Re-applied"),
);

const passengerImportRow = v.object({
  id: v.string(),
  sourceSheet: v.string(),
  sourceRowNumber: v.number(),
  importKind: v.optional(importKindValidator),
  importKey: v.string(),
  fullName: v.string(),
  travelHub: v.optional(v.string()),
  foodPreference: foodPreferenceValidator,
  guestType: v.union(v.literal("Employee"), v.literal("Client"), v.literal("VIP")),
  paymentType: v.union(
    v.literal("Company Paid"),
    v.literal("Self Paid"),
    v.literal("Upgraded Self Paid"),
  ),
  roomType: v.union(
    v.literal("SGL"),
    v.literal("Twin"),
    v.literal("DBL"),
    v.literal("Child with Bed"),
    v.literal("Family Room"),
  ),
  visaRequired: v.boolean(),
  domesticTravelRequired: v.optional(v.boolean()),
  passportStatus: v.optional(v.string()),
  specialRequests: v.optional(v.string()),
  sourceDealerCode: v.optional(v.string()),
  sourceDealerName: v.optional(v.string()),
  sourceDescription: v.optional(v.string()),
  sourceSoName: v.optional(v.string()),
  sourceRsoName: v.optional(v.string()),
  sourceGroup: v.optional(v.string()),
  gender: v.optional(v.string()),
  contactNo: v.optional(v.string()),
  hotelAllocation: v.optional(v.string()),
  visaStatus: v.optional(visaStatusValidator),
  biometricAppointmentDate: v.optional(v.string()),
  visaNotes: v.optional(v.string()),
  passportNumberHash: v.optional(v.string()),
  encryptedPassportPayload: v.optional(v.string()),
  passportLastFour: v.optional(v.string()),
  passportExpiryDate: v.optional(v.string()),
  ticketing: v.optional(
    v.object({
      internationalFare: v.optional(v.string()),
      internationalPnr: v.optional(v.string()),
      internationalVendor: v.optional(v.string()),
      domesticTicket: v.optional(v.string()),
      domesticPnr: v.optional(v.string()),
      domesticVendor: v.optional(v.string()),
    }),
  ),
});

const flightSegmentInput = v.object({
  id: v.string(),
  sourceSheet: v.string(),
  sourceRowNumber: v.optional(v.number()),
  sourceGroupIndex: v.number(),
  segmentIndex: v.number(),
  importKey: v.string(),
  dateLabel: v.string(),
  airline: v.string(),
  flightNumber: v.string(),
  departTime: v.optional(v.string()),
  origin: v.string(),
  arriveTime: v.optional(v.string()),
  destination: v.string(),
  duration: v.optional(v.string()),
  transit: v.optional(v.string()),
});

const flightGroupInput = v.object({
  id: v.string(),
  sourceSheet: v.string(),
  groupIndex: v.number(),
  name: v.string(),
  segments: v.array(flightSegmentInput),
});

async function getVisibleJob(ctx: any, access: any, jobCardId: Id<"jobCards">) {
  const job = await ctx.db.get(jobCardId);
  const linkedQuery = job?.queryId ? await ctx.db.get(job.queryId) : null;
  if (!job || !canSeeJobCardRecord(access, job, linkedQuery)) {
    return null;
  }
  return job;
}

function groupImportKey(sheet: string, groupIndex: number) {
  return `${sheet.trim().toLowerCase()}|${groupIndex}`;
}

function summarizeGroup(group: {
  sourceSheet: string;
  groupIndex: number;
  segments: Array<{
    airline: string;
    flightNumber: string;
    dateLabel: string;
    origin: string;
    destination: string;
  }>;
}) {
  const first = group.segments[0];
  const last = group.segments[group.segments.length - 1] ?? first;
  const airlines = Array.from(
    group.segments.reduce((set, segment) => {
      if (segment.airline) set.add(segment.airline);
      return set;
    }, new Set<string>()),
  );
  const flightNumbers = group.segments.reduce((items, segment) => {
    if (segment.flightNumber) items.push(segment.flightNumber);
    return items;
  }, [] as string[]);
  return {
    name: `${group.sourceSheet} itinerary ${group.groupIndex + 1}`,
    route: [first?.origin, last?.destination].filter(Boolean).join(" - "),
    airline: airlines.length === 1 ? airlines[0] : airlines.join(" / "),
    flightNumber: flightNumbers.join(" / "),
    departureDate: first?.dateLabel ?? "",
    arrivalDate: last?.dateLabel ?? "",
  };
}

type TravellerDoc = {
  _id: Id<"travellers">;
  jobCardId: Id<"jobCards">;
  fullName: string;
  importKey?: string;
  visaStatus?: string;
  [key: string]: unknown;
};

type TravellerMatchIndex = {
  byImportKey: Map<string, TravellerDoc>;
  byNormalizedName: Map<string, TravellerDoc>;
  byPassportHash: Map<string, TravellerDoc>;
};

async function buildTravellerMatchIndex(
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

function registerTravellerInIndex(index: TravellerMatchIndex, traveller: TravellerDoc) {
  if (traveller.importKey) {
    index.byImportKey.set(traveller.importKey, traveller);
  }
  index.byNormalizedName.set(traveller.fullName.trim().toLowerCase(), traveller);
}

function findTravellerMatchInIndex(index: TravellerMatchIndex, row: any): TravellerDoc | null {
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

function summarizeRoomTypesFromRows(rows: Array<{ roomType?: string }>) {
  const summary: Record<string, number> = {};
  for (const row of rows) {
    const roomType = row.roomType?.trim();
    if (!roomType) continue;
    summary[roomType] = (summary[roomType] ?? 0) + 1;
  }
  return summary;
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
    patch.roomType = row.roomType;
    patch.visaRequired = row.visaRequired;
    patch.domesticTravelRequired = row.domesticTravelRequired ?? false;
    patch.passportStatus = row.passportStatus?.trim() || "Pending";
    patch.specialRequests = row.specialRequests?.trim() || "";
    return patch;
  }

  if (importKind === "rooming") {
    patch.roomType = row.roomType;
    if (includeText(row.travelHub)) patch.travelHub = row.travelHub.trim();
    if (includeText(row.specialRequests)) patch.specialRequests = row.specialRequests.trim();
    if (includeText(row.hotelAllocation)) patch.hotelAllocation = row.hotelAllocation.trim();
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

export const previewPassengerImportRows = internalQuery({
  args: {
    jobCardId: v.string(),
    rows: v.array(passengerImportRow),
    access: v.any(),
  },
  handler: async (ctx, args) => {
    const jobCardId = ctx.db.normalizeId("jobCards", args.jobCardId);
    if (!jobCardId) throw new ConvexError("Invalid Job Card id");
    const job = await getVisibleJob(ctx, args.access, jobCardId);
    if (!job) throw new ConvexError("FORBIDDEN");

    const matchIndex = await buildTravellerMatchIndex(ctx, jobCardId);
    const results = args.rows.map((row) => {
      const match = findTravellerMatchInIndex(matchIndex, row);
      return {
        id: row.id,
        action: match ? "update" : "create",
        travellerId: match?._id ?? null,
        travellerName: match?.fullName ?? "",
      };
    });
    return { rows: results, roomSummary: summarizeRoomTypesFromRows(args.rows) };
  },
});

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

export const commitPassengerImportBatch = internalMutation({
  args: {
    jobCardId: v.string(),
    rows: v.array(passengerImportRow),
    access: v.any(),
    logActivity: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const jobCardId = ctx.db.normalizeId("jobCards", args.jobCardId);
    if (!jobCardId) throw new ConvexError("Invalid Job Card id");
    const job = await getVisibleJob(ctx, args.access, jobCardId);
    if (!job) throw new ConvexError("FORBIDDEN");

    const matchIndex = await buildTravellerMatchIndex(ctx, jobCardId);
    return await processImportRows(ctx, {
      jobCardId,
      rows: args.rows,
      access: args.access,
      job,
      matchIndex,
      logActivity: args.logActivity ?? false,
    });
  },
});

export const commitPassengerImportRows = internalMutation({
  args: {
    jobCardId: v.string(),
    rows: v.array(passengerImportRow),
    access: v.any(),
  },
  handler: async (ctx, args) => {
    const jobCardId = ctx.db.normalizeId("jobCards", args.jobCardId);
    if (!jobCardId) throw new ConvexError("Invalid Job Card id");
    const job = await getVisibleJob(ctx, args.access, jobCardId);
    if (!job) throw new ConvexError("FORBIDDEN");

    const matchIndex = await buildTravellerMatchIndex(ctx, jobCardId);
    return await processImportRows(ctx, {
      jobCardId,
      rows: args.rows,
      access: args.access,
      job,
      matchIndex,
      logActivity: true,
    });
  },
});

export const commitFlightImport = mutation({
  args: {
    jobCardId: v.string(),
    groups: v.array(flightGroupInput),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.MANAGE_TICKETING);
    const jobCardId = ctx.db.normalizeId("jobCards", args.jobCardId);
    if (!jobCardId) throw new ConvexError("Invalid Job Card id");
    const job = await getVisibleJob(ctx, access, jobCardId);
    if (!job) throw new ConvexError("FORBIDDEN");

    const now = Date.now();
    let createdGroups = 0;
    let updatedGroups = 0;
    let createdSegments = 0;
    let updatedSegments = 0;

    for (const group of args.groups) {
      const importKey = groupImportKey(group.sourceSheet, group.groupIndex);
      const summary = summarizeGroup(group);
      const existingGroup = await ctx.db
        .query("flightGroups")
        .withIndex("by_jobCardId_importKey", (q) =>
          q.eq("jobCardId", jobCardId).eq("importKey", importKey),
        )
        .first();

      let flightGroupId: Id<"flightGroups">;
      const groupPatch = {
        name: group.name.trim() || summary.name,
        route: summary.route,
        airline: summary.airline,
        flightNumber: summary.flightNumber,
        departureDate: summary.departureDate,
        arrivalDate: summary.arrivalDate,
        ticketingType: "Imported Itinerary",
        totalSeats: 0,
        importKey,
        sourceSheet: group.sourceSheet,
        sourceGroupIndex: group.groupIndex,
        updatedAt: now,
      };

      if (existingGroup) {
        await ctx.db.patch(existingGroup._id, groupPatch);
        flightGroupId = existingGroup._id;
        updatedGroups += 1;
      } else {
        flightGroupId = await ctx.db.insert("flightGroups", {
          jobCardId,
          ...groupPatch,
          createdBy: access.authUserId ?? "unknown",
          createdAt: now,
        });
        createdGroups += 1;
      }

      const incomingKeys = new Set(group.segments.map((segment) => segment.importKey));
      const existingSegments = await ctx.db
        .query("flightSegments")
        .withIndex("by_flightGroupId", (q) => q.eq("flightGroupId", flightGroupId))
        .collect();
      const existingSegmentByImportKey = new Map(
        existingSegments.map((segment) => [segment.importKey, segment]),
      );
      await Promise.all(
        existingSegments.flatMap((existingSegment) =>
          incomingKeys.has(existingSegment.importKey) ? [] : [ctx.db.delete(existingSegment._id)],
        ),
      );

      const segmentResults = await Promise.all(
        group.segments.map(async (segment) => {
          const existingSegment = existingSegmentByImportKey.get(segment.importKey);
          const segmentPatch = {
            jobCardId,
            flightGroupId,
            importKey: segment.importKey,
            sourceSheet: segment.sourceSheet,
            sourceRowNumber: segment.sourceRowNumber,
            sourceGroupIndex: segment.sourceGroupIndex,
            segmentIndex: segment.segmentIndex,
            dateLabel: segment.dateLabel,
            airline: segment.airline,
            flightNumber: segment.flightNumber,
            departTime: segment.departTime ?? "",
            origin: segment.origin,
            arriveTime: segment.arriveTime ?? "",
            destination: segment.destination,
            duration: segment.duration ?? "",
            transit: segment.transit ?? "",
            updatedAt: now,
          };
          if (existingSegment) {
            await ctx.db.patch(existingSegment._id, segmentPatch);
            return "updated";
          }
          await ctx.db.insert("flightSegments", {
            ...segmentPatch,
            createdBy: access.authUserId ?? "unknown",
            createdAt: now,
          });
          return "created";
        }),
      );
      for (const result of segmentResults) {
        if (result === "created") createdSegments += 1;
        if (result === "updated") updatedSegments += 1;
      }
    }

    await createActivity(ctx, access, {
      entityType: "flightGroup",
      entityId: jobCardId,
      action: "imported",
      message: `${createdSegments + updatedSegments} flight segments imported for ${job.jobCode}`,
    });

    return {
      createdGroups,
      updatedGroups,
      createdSegments,
      updatedSegments,
      totalGroups: args.groups.length,
      totalSegments: args.groups.reduce((sum, group) => sum + group.segments.length, 0),
    };
  },
});

export const getPassengerExportSource = internalQuery({
  args: {
    jobCardId: v.string(),
    access: v.any(),
  },
  handler: async (ctx, args) => {
    const jobCardId = ctx.db.normalizeId("jobCards", args.jobCardId);
    if (!jobCardId) throw new ConvexError("Invalid Job Card id");
    const job = await getVisibleJob(ctx, args.access, jobCardId);
    if (!job) throw new ConvexError("FORBIDDEN");

    const travellers = await ctx.db
      .query("travellers")
      .withIndex("by_jobCardId", (q) => q.eq("jobCardId", jobCardId))
      .collect();

    const rows = await Promise.all(
      travellers
        .sort((a, b) => a.fullName.localeCompare(b.fullName))
        .map(async (traveller) => {
          const [passport, visaRecord, ticketRows] = await Promise.all([
            ctx.db
              .query("passportDetails")
              .withIndex("by_travellerId", (q) => q.eq("travellerId", traveller._id))
              .unique(),
            ctx.db
              .query("visaRecords")
              .withIndex("by_travellerId", (q) => q.eq("travellerId", traveller._id))
              .unique(),
            ctx.db
              .query("tickets")
              .withIndex("by_travellerId", (q) => q.eq("travellerId", traveller._id))
              .collect(),
          ]);
          const ticketRowsWithPnr = await Promise.all(
            ticketRows.map(async (ticket) => {
              const pnr = ticket.pnrId ? await ctx.db.get(ticket.pnrId) : null;
              return {
                ticketNumber: ticket.ticketNumber ?? "",
                ticketType: ticket.ticketType ?? "",
                pnrCode: pnr?.pnrCode ?? "",
                airline: pnr?.airline ?? "",
                route: pnr?.route ?? "",
                fareType: pnr?.fareType ?? "",
              };
            }),
          );

          return {
            travellerId: traveller._id,
            fullName: traveller.fullName,
            travelHub: traveller.travelHub ?? "",
            foodPreference: traveller.foodPreference,
            paymentType: traveller.paymentType,
            roomType: traveller.roomType,
            visaRequired: traveller.visaRequired,
            visaStatus: traveller.visaStatus,
            hotelAllocation: traveller.hotelAllocation ?? "",
            gender: traveller.gender ?? "",
            contactNo: traveller.contactNo ?? "",
            specialRequests: traveller.specialRequests ?? "",
            sourceDealerCode: traveller.sourceDealerCode ?? "",
            sourceDealerName: traveller.sourceDealerName ?? "",
            sourceDescription: traveller.sourceDescription ?? "",
            sourceSoName: traveller.sourceSoName ?? "",
            sourceRsoName: traveller.sourceRsoName ?? "",
            sourceGroup: traveller.sourceGroup ?? "",
            cancellation: traveller.cancellation ?? false,
            lastMinuteDrop: traveller.lastMinuteDrop ?? false,
            encryptedPassportPayload: passport?.encryptedPayload ?? "",
            tickets: ticketRowsWithPnr,
            visa: visaRecord
              ? {
                  status: visaRecord.status,
                  appointmentDate: visaRecord.appointmentDate ?? "",
                  notes: visaRecord.notes ?? "",
                }
              : {
                  status: traveller.visaStatus,
                  appointmentDate: traveller.biometricAppointmentDate ?? "",
                  notes: "",
                },
          };
        }),
    );

    return {
      jobCode: job.jobCode,
      clientName: job.clientName,
      rows,
    };
  },
});

export const logPassengerExport = internalMutation({
  args: {
    jobCardId: v.string(),
    rowCount: v.number(),
    exportKind: v.optional(importKindValidator),
    access: v.any(),
  },
  handler: async (ctx, args) => {
    const jobCardId = ctx.db.normalizeId("jobCards", args.jobCardId);
    if (!jobCardId) return;
    const job = await ctx.db.get(jobCardId);
    if (!job) return;

    const exportedKind = args.exportKind ?? "passenger";
    const exportedLabel =
      exportedKind === "passenger"
        ? "passengers"
        : exportedKind === "traveller"
          ? "travellers"
          : `${exportedKind} rows`;

    await createActivity(ctx, args.access, {
      entityType: "traveller",
      entityId: jobCardId,
      action: "exported",
      message: `${args.rowCount} ${exportedLabel} exported for ${job.jobCode}`,
    });
  },
});

export const listFlightItinerary = query({
  args: {},
  handler: async (ctx) => {
    const [access, groups] = await Promise.all([
      requireStaff(ctx, PERMISSIONS.VIEW_TICKETING),
      ctx.db.query("flightGroups").collect(),
    ]);
    const result = await Promise.all(
      groups
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .map(async (group) => {
          const job = await getVisibleJob(ctx, access, group.jobCardId);
          if (!job) return null;
          const segments = await ctx.db
            .query("flightSegments")
            .withIndex("by_flightGroupId", (q) => q.eq("flightGroupId", group._id))
            .collect();
          return {
            id: group._id,
            jobCardId: group.jobCardId,
            jobCode: job.jobCode,
            clientName: job.clientName,
            name: group.name,
            route: group.route,
            airline: group.airline,
            departureDate: group.departureDate,
            arrivalDate: group.arrivalDate ?? "",
            sourceSheet: group.sourceSheet ?? "",
            sourceGroupIndex: group.sourceGroupIndex ?? 0,
            importKey: group.importKey ?? "",
            segments: segments
              .sort((a, b) => a.segmentIndex - b.segmentIndex)
              .map((segment) => ({
                id: segment._id,
                importKey: segment.importKey,
                dateLabel: segment.dateLabel,
                airline: segment.airline,
                flightNumber: segment.flightNumber,
                departTime: segment.departTime ?? "",
                origin: segment.origin,
                arriveTime: segment.arriveTime ?? "",
                destination: segment.destination,
                duration: segment.duration ?? "",
                transit: segment.transit ?? "",
              })),
            updatedAt: new Date(group.updatedAt).toISOString(),
          };
        }),
    );
    return result.filter(Boolean);
  },
});
