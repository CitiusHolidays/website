import type { Infer } from "convex/values";
import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import type { RuntimeObject, RuntimeValue } from "../../lib/runtimeValues";
import {
  isRuntimeBoolean,
  isRuntimeNumber,
  isRuntimeObject,
  isRuntimeString,
  propertiesWhen,
} from "../../lib/runtimeValues";
import { scheduleCrmMetricSync } from "../financeMetricSync";
import type { JobCardStatus } from "../jobCardConstants";
import { markListSearchDirty } from "../listSearch";
import type {
  ContractingStatus,
  QuerySourceOutput,
  QueryType,
  SalesStatus,
  TicketingScopeOutput,
  TravelType,
} from "../queryValidators";
import type {
  jobCardDetailRowValidator,
  paymentTermsOutputValidator,
  preDepartureChecklistOutputValidator,
} from "../returnContracts";
import { deleteEntityNotifications } from "./notifications";
import type { JobCardVisibilityRecord, QueryVisibilityRecord } from "./recordScope";

type PaymentTermsOutput = Infer<typeof paymentTermsOutputValidator>;
type PreDepartureChecklistOutput = Infer<typeof preDepartureChecklistOutputValidator>;

function normalizePaymentTermsOutput<Value>(value: Value): PaymentTermsOutput {
  if (
    value &&
    isRuntimeObject(value) &&
    "label" in value &&
    isRuntimeString(value.label) &&
    "maxAdvancePercent" in value &&
    isRuntimeNumber(value.maxAdvancePercent) &&
    "minAdvancePercent" in value &&
    isRuntimeNumber(value.minAdvancePercent)
  ) {
    return {
      label: value.label,
      maxAdvancePercent: value.maxAdvancePercent,
      minAdvancePercent: value.minAdvancePercent,
    };
  }
  return null;
}

function normalizePreDepartureChecklistOutput<Value>(value: Value): PreDepartureChecklistOutput {
  if (value === null || value === undefined) {
    return null;
  }
  if (!Array.isArray(value)) {
    return null;
  }
  return value.flatMap((item) => {
    if (!(item && isRuntimeObject(item))) {
      return [];
    }
    // SAFETY: the preceding runtime-object and non-array guards establish a RuntimeObject row.
    const row = item as RuntimeObject;
    return [
      {
        category: isRuntimeString(row.category) ? row.category : undefined,
        completed: isRuntimeBoolean(row.completed) ? row.completed : undefined,
        done: isRuntimeBoolean(row.done) ? row.done : undefined,
        dueDate: isRuntimeString(row.dueDate) ? row.dueDate : undefined,
        key: isRuntimeString(row.key) ? row.key : undefined,
        label: isRuntimeString(row.label) ? row.label : undefined,
        owner: isRuntimeString(row.owner) ? row.owner : undefined,
        status: isRuntimeString(row.status) ? row.status : undefined,
        title: isRuntimeString(row.title) ? row.title : undefined,
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
    ...propertiesWhen(metadata.initiatedByStaffId, () => ({
      initiatedByStaffId: metadata.initiatedByStaffId,
    })),
    jobCardId: String(jobCardId),
    jobCode: metadata.jobCode,
    lastProgressAt: now,
    stage: "travellers",
    stageCounts: [],
    startedAt: now,
    status: "running",
  });
  // Materialize legacy files and mark every chain file recoverable while the
  // Job Card still exists; the cascade removes the source record immediately.
  await ctx.runMutation(internal.crm.commercialFiles.markFilesDeletedForSource, {
    sourceId: String(jobCardId),
    sourceType: "jobCard",
  });
  await Promise.all([
    deleteEntityNotifications(ctx, "jobCard", jobCardId),
    ctx.db.delete("jobCards", jobCardId),
    ctx.scheduler.runAfter(0, internal.crm.jobCardDeletion.continueJobCardCascade, {
      jobCardId: String(jobCardId),
      operationId,
      stage: "travellers",
    }),
  ]);
  await markListSearchDirty(ctx, "jobCards", String(jobCardId));
  await scheduleCrmMetricSync(ctx, "jobCards", String(jobCardId));
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
  paymentTerms?: RuntimeValue;
  preDepartureChecklist?: RuntimeValue;
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
): Infer<typeof jobCardDetailRowValidator> {
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
  // SAFETY: query source and ticketing scope are schema-validated closed unions when present.
  return {
    approxMargin: isRuntimeNumber(query.approxMargin) ? query.approxMargin : null,
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
