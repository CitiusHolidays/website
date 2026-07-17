import { paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import { JOB_CARD_STATUS } from "./jobCardConstants";
import {
  contractingStatusValidator,
  querySourceValidator,
  queryTypeValidator,
  salesStatusValidator,
  ticketingScopeValidator,
  travelTypeValidator,
} from "./queryValidators";

const isoDateTimeStringValidator = v.string();
const nullableIsoDateTimeValidator = v.union(isoDateTimeStringValidator, v.null());
const emptyOrQuerySourceValidator = v.union(querySourceValidator, v.literal(""));
const emptyOrTicketingScopeValidator = v.union(ticketingScopeValidator, v.literal(""));

export const paymentTermsOutputValidator = v.union(
  v.null(),
  v.object({
    label: v.string(),
    maxAdvancePercent: v.number(),
    minAdvancePercent: v.number(),
  })
);

export const preDepartureChecklistItemOutputValidator = v.object({
  category: v.optional(v.string()),
  completed: v.optional(v.boolean()),
  done: v.optional(v.boolean()),
  dueDate: v.optional(v.string()),
  key: v.optional(v.string()),
  label: v.optional(v.string()),
  owner: v.optional(v.string()),
  status: v.optional(v.string()),
  title: v.optional(v.string()),
});

export const preDepartureChecklistOutputValidator = v.union(
  v.null(),
  v.array(preDepartureChecklistItemOutputValidator)
);

export const queryListAttachmentValidator = v.object({
  createdAt: isoDateTimeStringValidator,
  fileName: v.string(),
  fileSize: v.number(),
  id: v.id("queryAttachments"),
  mimeType: v.string(),
});

export const queryListRowValidator = v.object({
  approxMargin: v.union(v.null(), v.number()),
  attachmentCount: v.number(),
  attachments: v.array(queryListAttachmentValidator),
  batchingNotes: v.string(),
  budgetAmount: v.number(),
  clientName: v.string(),
  confirmedAt: nullableIsoDateTimeValidator,
  contactMobile: v.string(),
  contactPerson: v.string(),
  contractingAirlinesCost: v.number(),
  contractingLandCost: v.number(),
  contractingOwnerId: v.string(),
  contractingOwnerName: v.string(),
  contractingStatus: contractingStatusValidator,
  contractingVisaCost: v.number(),
  createdAt: isoDateTimeStringValidator,
  destination: v.string(),
  id: v.id("queries"),
  jobCardCreatorName: v.string(),
  jobCardCreatorStaffId: v.string(),
  leadStage: v.string(),
  lostReason: v.string(),
  notes: v.string(),
  paxCount: v.number(),
  queryCode: v.string(),
  queryType: queryTypeValidator,
  salesOwnerName: v.string(),
  salesStatus: salesStatusValidator,
  source: emptyOrQuerySourceValidator,
  submittedToContractingAt: nullableIsoDateTimeValidator,
  ticketingOwnerId: v.string(),
  ticketingOwnerName: v.string(),
  ticketingScope: emptyOrTicketingScopeValidator,
  travelEndDate: v.string(),
  travelInBatches: v.boolean(),
  travelStartDate: v.string(),
  travelType: travelTypeValidator,
  updatedAt: isoDateTimeStringValidator,
});

export const queryListPageResultValidator = paginationResultValidator(queryListRowValidator);
export const queryGetListRowResultValidator = v.union(queryListRowValidator, v.null());
export const queryIdResultValidator = v.object({ id: v.id("queries") });
export const salesPipelineMoveResultValidator = v.object({
  fromStage: v.string(),
  id: v.id("queries"),
  toStage: v.string(),
});
export const contractingPipelineMoveResultValidator = v.object({
  fromStage: v.string(),
  id: v.id("queries"),
  proposalId: v.id("proposals"),
  toStage: v.string(),
});
export const queryCreateResultValidator = v.object({
  id: v.id("queries"),
  queryCode: v.string(),
});

export const jobCardListRowValidator = v.object({
  clientName: v.string(),
  collaboratorStaffIds: v.array(v.string()),
  confirmedPax: v.number(),
  contractingOwnerId: v.string(),
  contractingOwnerName: v.string(),
  createdAt: isoDateTimeStringValidator,
  destination: v.string(),
  id: v.id("jobCards"),
  jobCode: v.string(),
  lastEditedAt: nullableIsoDateTimeValidator,
  lastEditedByName: v.string(),
  operationsOwnerId: v.string(),
  operationsOwnerName: v.string(),
  paymentTerms: paymentTermsOutputValidator,
  preDepartureChecklist: preDepartureChecklistOutputValidator,
  proposalId: v.union(v.null(), v.id("proposals")),
  queryId: v.union(v.null(), v.id("queries")),
  queryType: v.string(),
  roomCount: v.number(),
  status: JOB_CARD_STATUS,
  ticketingOwnerId: v.string(),
  ticketingOwnerName: v.string(),
  ticketingRequired: v.boolean(),
  ticketingScope: v.string(),
  tourManagerName: v.string(),
  travelBatchCount: v.number(),
  travelEndDate: v.string(),
  travelStartDate: v.string(),
  updatedAt: isoDateTimeStringValidator,
});

export const jobCardListPageResultValidator = paginationResultValidator(jobCardListRowValidator);
export const jobCardGetListRowResultValidator = v.union(jobCardListRowValidator, v.null());
export const jobCardIdResultValidator = v.object({ id: v.id("jobCards") });
export const jobCardDeletionStatusValidator = v.union(
  v.literal("running"),
  v.literal("complete"),
  v.literal("failed")
);
export const jobCardDeletionResultValidator = v.object({
  id: v.id("jobCards"),
  operationId: v.id("jobCardDeletionOperations"),
  status: jobCardDeletionStatusValidator,
});
export const jobCardDeletionOperationValidator = v.object({
  completedAt: v.optional(v.number()),
  deletedCount: v.number(),
  failedAt: v.optional(v.number()),
  failureSummary: v.optional(v.string()),
  id: v.id("jobCardDeletionOperations"),
  jobCardId: v.string(),
  jobCode: v.string(),
  lastProgressAt: v.number(),
  stage: v.string(),
  stageCounts: v.array(v.object({ count: v.number(), stage: v.string() })),
  stalled: v.boolean(),
  startedAt: v.number(),
  status: jobCardDeletionStatusValidator,
});
export const jobCardDeletionOperationListValidator = v.array(jobCardDeletionOperationValidator);
export const jobCardCreateResultValidator = v.object({
  id: v.id("jobCards"),
  jobCode: v.string(),
});

export const travelBatchListRowValidator = v.object({
  batchCode: v.string(),
  batchReference: v.string(),
  confirmedPax: v.number(),
  contractingOwnerId: v.string(),
  contractingOwnerName: v.string(),
  createdAt: isoDateTimeStringValidator,
  destination: v.string(),
  id: v.id("travelBatches"),
  jobCardId: v.id("jobCards"),
  lastEditedAt: nullableIsoDateTimeValidator,
  lastEditedByName: v.string(),
  operationsOwnerId: v.string(),
  operationsOwnerName: v.string(),
  paymentTerms: paymentTermsOutputValidator,
  preDepartureChecklist: preDepartureChecklistOutputValidator,
  queryType: v.string(),
  roomCount: v.number(),
  status: v.string(),
  ticketingOwnerId: v.string(),
  ticketingOwnerName: v.string(),
  tourManagerName: v.string(),
  travelEndDate: v.string(),
  travelStartDate: v.string(),
  updatedAt: isoDateTimeStringValidator,
});

export const travelBatchListPageResultValidator = paginationResultValidator(
  travelBatchListRowValidator
);
export const travelBatchCreateResultValidator = v.object({
  batchCode: v.string(),
  batchReference: v.string(),
  id: v.id("travelBatches"),
});
export const travelBatchIdResultValidator = v.object({ id: v.id("travelBatches") });
export const checklistTaskIdResultValidator = v.object({ id: v.id("checklistTasks") });

const operationalProposalAttachmentValidator = v.object({
  createdAt: isoDateTimeStringValidator,
  fileName: v.string(),
  fileSize: v.number(),
  id: v.id("proposalAttachments"),
  mimeType: v.string(),
});

export const jobCardCommandCenterResultValidator = v.object({
  checklistTasks: v.array(
    v.object({
      _id: v.id("checklistTasks"),
      category: v.string(),
      completed: v.boolean(),
      dueDate: v.optional(v.string()),
      title: v.string(),
    })
  ),
  hotels: v.array(v.object({ id: v.id("hotels") })),
  invoices: v.array(v.object({ balanceAmount: v.number(), id: v.id("invoices") })),
  jobCard: jobCardListRowValidator,
  proposal: v.union(
    v.null(),
    v.object({
      attachments: v.array(operationalProposalAttachmentValidator),
      clientName: v.string(),
      finalizedPdf: v.union(
        v.null(),
        v.object({
          fileName: v.string(),
          uploadedAt: nullableIsoDateTimeValidator,
        })
      ),
      id: v.id("proposals"),
      itinerarySummary: v.string(),
      proposalCode: v.string(),
      status: v.union(
        v.literal("Draft"),
        v.literal("Sent"),
        v.literal("Accepted"),
        v.literal("Rejected")
      ),
    })
  ),
  query: v.union(
    v.null(),
    v.object({
      clientName: v.string(),
      contractingStatus: contractingStatusValidator,
      destination: v.string(),
      id: v.id("queries"),
      queryCode: v.string(),
      salesStatus: salesStatusValidator,
    })
  ),
  rooming: v.array(v.object({ id: v.id("roomingListEntries") })),
  tickets: v.array(v.object({ ticketStatus: v.string() })),
  travellers: v.array(v.object({ passportStatus: v.string() })),
  visaRecords: v.array(v.object({ status: v.string() })),
});

const salesPipelineStageValidator = v.union(
  v.literal("Inquiry"),
  v.literal("Proposal"),
  v.literal("Negotiation"),
  v.literal("Confirmation"),
  v.literal("Lost")
);

const metricTrendDirectionValidator = v.union(
  v.literal("up"),
  v.literal("down"),
  v.literal("flat")
);

const metricTrendValidator = v.object({
  delta: v.number(),
  direction: metricTrendDirectionValidator,
});

const progressSliceValidator = v.object({
  done: v.number(),
  percent: v.number(),
  total: v.number(),
});

const queryTypeCountValidator = v.object({
  count: v.number(),
  type: queryTypeValidator,
});

const pipelineStageSnapshotValidator = v.object({
  count: v.number(),
  stage: salesPipelineStageValidator,
  value: v.number(),
  weighted: v.number(),
});

const aggregateCoverageValidator = v.object({
  bucketCount: v.number(),
  complete: v.boolean(),
  completedSources: v.array(v.string()),
  detailRowLimit: v.number(),
  errorSummary: v.union(v.null(), v.string()),
  freshnessMinutes: v.number(),
  generation: v.number(),
  lastCompletedAt: nullableIsoDateTimeValidator,
  state: v.union(
    v.literal("ready"),
    v.literal("stale"),
    v.literal("reconciling"),
    v.literal("pending")
  ),
  updatedAt: nullableIsoDateTimeValidator,
  version: v.union(v.null(), v.number()),
});

const activeTourValidator = v.object({
  clientName: v.string(),
  destination: v.string(),
  id: v.id("jobCards"),
  jobCode: v.string(),
  pax: v.number(),
  status: JOB_CARD_STATUS,
  ticketProgress: v.number(),
  visaProgress: v.number(),
});

const capacityRowValidator = v.object({
  averageLoad: v.number(),
  load: v.number(),
  role: v.string(),
  severity: v.union(v.literal("overloaded"), v.literal("busy"), v.literal("normal")),
  staffCount: v.number(),
});

const departmentWorkflowValidator = v.object({
  label: v.string(),
  percent: v.number(),
  value: v.number(),
});

const dashboardMetricsValidator = v.object({
  activeQueries: v.number(),
  confirmedJobs: v.number(),
  departures30d: v.number(),
  jobCardsOpen: v.number(),
  outstandingAmount: v.number(),
  paymentPending: v.number(),
  pendingApprovals: v.number(),
  proposalsSent: v.number(),
  revenuePipeline: v.number(),
  ticketsIssued: v.number(),
  ticketsPending: v.number(),
  visaPending: v.number(),
});

const teamMemberValidator = v.object({
  department: v.string(),
  email: v.string(),
  function: v.string(),
  id: v.id("staffUsers"),
  location: v.string(),
  name: v.string(),
});

const overdueInvoiceValidator = v.object({
  balanceAmount: v.number(),
  clientName: v.string(),
  dueDate: v.string(),
  id: v.id("invoices"),
  invoiceNumber: v.string(),
});

const recentActivityValidator = v.object({
  action: v.string(),
  actorName: v.string(),
  createdAt: isoDateTimeStringValidator,
  entityId: v.string(),
  entityType: v.string(),
  id: v.id("activityLogs"),
  message: v.string(),
});

const ticketAttentionValidator = v.object({
  id: v.id("tickets"),
  ticketNumber: v.string(),
  ticketStatus: v.string(),
});

const ticketingStatsValidator = v.object({
  cancelReq: v.number(),
  onHold: v.number(),
  reissue: v.number(),
  upcomingDep: v.number(),
});

const upcomingDepartureValidator = v.object({
  clientName: v.string(),
  destination: v.string(),
  id: v.id("jobCards"),
  jobCode: v.string(),
  pax: v.number(),
  readiness: v.union(v.literal("Ready"), v.literal("Docs pending"), v.literal("Ticketing")),
  tourManagerName: v.string(),
  travelStartDate: v.string(),
});

const urgentActionValidator = v.object({
  createdAt: v.optional(isoDateTimeStringValidator),
  entityId: v.string(),
  entityType: v.string(),
  href: v.string(),
  id: v.string(),
  label: v.string(),
  type: v.union(
    v.literal("approvals"),
    v.literal("finance"),
    v.literal("accounts"),
    v.literal("ticketing")
  ),
});

const ownedWorkSlaItemValidator = v.object({
  count: v.number(),
  href: v.string(),
  label: v.string(),
  oldestDays: v.union(v.number(), v.null()),
});

const ownedWorkSlaValidator = v.object({
  items: v.array(ownedWorkSlaItemValidator),
  oldestDays: v.union(v.number(), v.null()),
  totalOpen: v.number(),
});

export const portalSummaryResultValidator = v.object({
  activeTours: v.array(activeTourValidator),
  aggregateCoverage: aggregateCoverageValidator,
  capacity: v.array(capacityRowValidator),
  closedQueriesByType: v.array(queryTypeCountValidator),
  confirmedQueriesByType: v.array(queryTypeCountValidator),
  departmentWorkflow: v.array(departmentWorkflowValidator),
  generatedAt: isoDateTimeStringValidator,
  metrics: dashboardMetricsValidator,
  metricTrends: v.object({
    activeQueries: metricTrendValidator,
    confirmedJobs: metricTrendValidator,
    departures30d: metricTrendValidator,
    jobCardsOpen: metricTrendValidator,
    proposalsSent: metricTrendValidator,
  }),
  myTeam: v.array(teamMemberValidator),
  overdueInvoices: v.array(overdueInvoiceValidator),
  ownedWorkSla: ownedWorkSlaValidator,
  pipelineSnapshot: v.array(pipelineStageSnapshotValidator),
  progress: v.object({
    guestData: progressSliceValidator,
    passport: progressSliceValidator,
    payment: progressSliceValidator,
    rooming: progressSliceValidator,
    tickets: progressSliceValidator,
    tourManager: progressSliceValidator,
    visas: progressSliceValidator,
  }),
  queriesByType: v.array(queryTypeCountValidator),
  recentActivity: v.array(recentActivityValidator),
  ticketAttentionQueue: v.array(ticketAttentionValidator),
  ticketingStats: ticketingStatsValidator,
  upcomingDepartures: v.array(upcomingDepartureValidator),
  urgentActions: v.array(urgentActionValidator),
});
