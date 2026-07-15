import type { Infer } from "convex/values";
import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import type { JobCardStatus } from "../jobCardConstants";
import type {
  ContractingStatus,
  QuerySourceOutput,
  QueryType,
  SalesStatus,
  TicketingScopeOutput,
  TravelType,
} from "../queryValidators";
import type {
  jobCardListRowValidator,
  paymentTermsOutputValidator,
  preDepartureChecklistOutputValidator,
} from "../returnContracts";
import { deleteEntityNotifications } from "./notifications";
import type { JobCardVisibilityRecord, QueryVisibilityRecord } from "./recordScope";

type PaymentTermsOutput = Infer<typeof paymentTermsOutputValidator>;
type PreDepartureChecklistOutput = Infer<typeof preDepartureChecklistOutputValidator>;

function normalizePaymentTermsOutput(value: unknown): PaymentTermsOutput {
  if (
    value &&
    typeof value === "object" &&
    typeof (value as { label?: unknown }).label === "string" &&
    typeof (value as { maxAdvancePercent?: unknown }).maxAdvancePercent === "number" &&
    typeof (value as { minAdvancePercent?: unknown }).minAdvancePercent === "number"
  ) {
    const terms = value as {
      label: string;
      maxAdvancePercent: number;
      minAdvancePercent: number;
    };
    return {
      label: terms.label,
      maxAdvancePercent: terms.maxAdvancePercent,
      minAdvancePercent: terms.minAdvancePercent,
    };
  }
  return null;
}

function normalizePreDepartureChecklistOutput(value: unknown): PreDepartureChecklistOutput {
  if (value === null || value === undefined) {
    return null;
  }
  if (!Array.isArray(value)) {
    return null;
  }
  return value.flatMap((item) => {
    if (!(item && typeof item === "object")) {
      return [];
    }
    const row = item as Record<string, unknown>;
    return [
      {
        category: typeof row.category === "string" ? row.category : undefined,
        completed: typeof row.completed === "boolean" ? row.completed : undefined,
        done: typeof row.done === "boolean" ? row.done : undefined,
        dueDate: typeof row.dueDate === "string" ? row.dueDate : undefined,
        key: typeof row.key === "string" ? row.key : undefined,
        label: typeof row.label === "string" ? row.label : undefined,
        owner: typeof row.owner === "string" ? row.owner : undefined,
        status: typeof row.status === "string" ? row.status : undefined,
        title: typeof row.title === "string" ? row.title : undefined,
      },
    ];
  });
}

export async function deleteJobCardCascade(
  ctx: MutationCtx,
  jobCardId: Id<"jobCards">,
  metadata: {
    initiatedBy: string;
    initiatedByStaffId?: Id<"staffUsers">;
    jobCode: string;
  }
) {
  const now = Date.now();
  const operationId = await ctx.db.insert("jobCardDeletionOperations", {
    deletedCount: 0,
    initiatedBy: metadata.initiatedBy,
    ...(metadata.initiatedByStaffId ? { initiatedByStaffId: metadata.initiatedByStaffId } : {}),
    jobCardId: String(jobCardId),
    jobCode: metadata.jobCode,
    lastProgressAt: now,
    stage: "travellers",
    stageCounts: [],
    startedAt: now,
    status: "running",
  });
  await Promise.all([
    deleteEntityNotifications(ctx, "jobCard", jobCardId),
    ctx.db.delete(jobCardId),
    ctx.scheduler.runAfter(0, internal.crm.jobCardDeletion.continueJobCardCascade, {
      jobCardId: String(jobCardId),
      operationId,
      stage: "travellers",
    }),
  ]);
  return operationId;
}

type JobCardPresentationRecord = JobCardVisibilityRecord & {
  _id: Id<"jobCards">;
  clientName: string;
  confirmedPax: number;
  createdAt: number;
  destination?: string;
  jobCode: string;
  lastEditedAt?: number;
  lastEditedByName?: string;
  paymentTerms?: unknown;
  preDepartureChecklist?: unknown;
  proposalId?: Id<"proposals"> | null;
  roomCount?: number;
  status: JobCardStatus;
  ticketingRequired?: boolean;
  ticketingScope?: string;
  travelBatchCount?: number;
  travelEndDate?: string;
  travelStartDate?: string;
  updatedAt: number;
};

export function publicJobCard(
  job: JobCardPresentationRecord,
  linkedQuery?: QueryVisibilityRecord | null
): Infer<typeof jobCardListRowValidator> {
  const ticketingScope = job.ticketingScope ?? linkedQuery?.ticketingScope ?? "";
  const ticketingRequired =
    job.ticketingRequired ??
    (String(ticketingScope).trim()
      ? String(ticketingScope).trim() !== "Not required"
      : Boolean(job.ticketingOwnerId ?? linkedQuery?.ticketingOwnerId));
  return {
    clientName: job.clientName,
    collaboratorStaffIds: (job.collaboratorStaffIds ?? []).map((staffId) => String(staffId)),
    confirmedPax: job.confirmedPax,
    contractingOwnerId: job.contractingOwnerId ?? "",
    contractingOwnerName: job.contractingOwnerName ?? "",
    createdAt: new Date(job.createdAt).toISOString(),
    destination: job.destination ?? "",
    id: job._id,
    jobCode: job.jobCode,
    lastEditedAt: job.lastEditedAt ? new Date(job.lastEditedAt).toISOString() : null,
    lastEditedByName: job.lastEditedByName ?? "",
    operationsOwnerId: job.operationsOwnerId ?? "",
    operationsOwnerName: job.operationsOwnerName ?? "",
    paymentTerms: normalizePaymentTermsOutput(job.paymentTerms),
    preDepartureChecklist: normalizePreDepartureChecklistOutput(job.preDepartureChecklist),
    proposalId: job.proposalId ?? null,
    queryId: job.queryId ?? null,
    queryType: job.queryType ?? "",
    roomCount: job.roomCount ?? 0,
    status: job.status,
    ticketingOwnerId: job.ticketingOwnerId ?? "",
    ticketingOwnerName: job.ticketingOwnerName ?? "",
    ticketingRequired,
    ticketingScope,
    tourManagerName: job.tourManagerName ?? "",
    travelBatchCount: job.travelBatchCount ?? 0,
    travelEndDate: job.travelEndDate ?? "",
    travelStartDate: job.travelStartDate ?? "",
    updatedAt: new Date(job.updatedAt).toISOString(),
  };
}

type TravelBatchPresentationRecord = {
  _id: Id<"travelBatches">;
  batchCode: string;
  batchReference: string;
  confirmedPax: number;
  contractingOwnerId?: string | null;
  contractingOwnerName?: string | null;
  createdAt: number;
  destination?: string;
  jobCardId: Id<"jobCards">;
  lastEditedAt?: number;
  lastEditedByName?: string;
  operationsOwnerId?: string | null;
  operationsOwnerName?: string | null;
  paymentTerms?: unknown;
  preDepartureChecklist?: unknown;
  queryType?: string;
  roomCount?: number;
  status: string;
  ticketingOwnerId?: string | null;
  ticketingOwnerName?: string | null;
  tourManagerName?: string | null;
  travelEndDate?: string;
  travelStartDate?: string;
  updatedAt: number;
};

export function publicTravelBatch(batch: TravelBatchPresentationRecord) {
  return {
    batchCode: batch.batchCode,
    batchReference: batch.batchReference,
    confirmedPax: batch.confirmedPax,
    contractingOwnerId: batch.contractingOwnerId ?? "",
    contractingOwnerName: batch.contractingOwnerName ?? "",
    createdAt: new Date(batch.createdAt).toISOString(),
    destination: batch.destination ?? "",
    id: batch._id,
    jobCardId: batch.jobCardId,
    lastEditedAt: batch.lastEditedAt ? new Date(batch.lastEditedAt).toISOString() : null,
    lastEditedByName: batch.lastEditedByName ?? "",
    operationsOwnerId: batch.operationsOwnerId ?? "",
    operationsOwnerName: batch.operationsOwnerName ?? "",
    paymentTerms: normalizePaymentTermsOutput(batch.paymentTerms),
    preDepartureChecklist: normalizePreDepartureChecklistOutput(batch.preDepartureChecklist),
    queryType: batch.queryType ?? "",
    roomCount: batch.roomCount ?? 0,
    status: batch.status,
    ticketingOwnerId: batch.ticketingOwnerId ?? "",
    ticketingOwnerName: batch.ticketingOwnerName ?? "",
    tourManagerName: batch.tourManagerName ?? "",
    travelEndDate: batch.travelEndDate ?? "",
    travelStartDate: batch.travelStartDate ?? "",
    updatedAt: new Date(batch.updatedAt).toISOString(),
  };
}

type QueryPresentationRecord = QueryVisibilityRecord & {
  approxMargin?: number | null;
  batchingNotes?: string;
  budgetAmount?: number;
  clientName: string;
  confirmedAt?: number | null;
  contactMobile?: string;
  contactPerson?: string;
  contractingAirlinesCost?: number;
  contractingLandCost?: number;
  contractingStatus: ContractingStatus;
  contractingVisaCost?: number;
  createdAt: number;
  destination?: string;
  _id: Id<"queries">;
  jobCardCreatorName?: string;
  jobCardCreatorStaffId?: string;
  leadStage?: string;
  lostReason?: string;
  notes?: string;
  paxCount: number;
  queryCode: string;
  queryType: QueryType;
  salesOwnerName?: string;
  salesStatus: SalesStatus;
  source?: string;
  submittedToContractingAt?: number | null;
  travelEndDate?: string;
  travelInBatches?: boolean;
  travelStartDate?: string;
  travelType: TravelType;
  updatedAt: number;
};

export function publicQuery(query: QueryPresentationRecord) {
  return {
    approxMargin: typeof query.approxMargin === "number" ? query.approxMargin : null,
    batchingNotes: query.batchingNotes ?? "",
    budgetAmount: query.budgetAmount ?? 0,
    clientName: query.clientName,
    confirmedAt: query.confirmedAt ? new Date(query.confirmedAt).toISOString() : null,
    contactMobile: query.contactMobile ?? "",
    contactPerson: query.contactPerson ?? "",
    contractingAirlinesCost: query.contractingAirlinesCost ?? 0,
    contractingLandCost: query.contractingLandCost ?? 0,
    contractingOwnerId: query.contractingOwnerId ?? "",
    contractingOwnerName: query.contractingOwnerName ?? "",
    contractingStatus: query.contractingStatus,
    contractingVisaCost: query.contractingVisaCost ?? 0,
    createdAt: new Date(query.createdAt).toISOString(),
    destination: query.destination ?? "",
    id: query._id,
    jobCardCreatorName: query.jobCardCreatorName ?? "",
    jobCardCreatorStaffId: query.jobCardCreatorStaffId ?? "",
    leadStage: query.leadStage === "Closed" ? "Lost" : (query.leadStage ?? ""),
    lostReason: query.lostReason ?? "",
    notes: query.notes ?? "",
    paxCount: query.paxCount,
    queryCode: query.queryCode,
    queryType: query.queryType,
    salesOwnerName: query.salesOwnerName ?? "",
    salesStatus: query.salesStatus,
    source: (query.source ?? "") as QuerySourceOutput,
    submittedToContractingAt: query.submittedToContractingAt
      ? new Date(query.submittedToContractingAt).toISOString()
      : null,
    ticketingOwnerId: query.ticketingOwnerId ?? "",
    ticketingOwnerName: query.ticketingOwnerName ?? "",
    ticketingScope: (query.ticketingScope ?? "") as TicketingScopeOutput,
    travelEndDate: query.travelEndDate ?? "",
    travelInBatches: Boolean(query.travelInBatches),
    travelStartDate: query.travelStartDate ?? "",
    travelType: query.travelType,
    updatedAt: new Date(query.updatedAt).toISOString(),
  };
}
