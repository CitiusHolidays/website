import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { loadCommercialChainFilesForEntryPoint } from "./commercialRecordChainReads";
import { getChecklistTasksWithFallback } from "./jobCardChecklist";
import {
  canSeeJobCardRecord,
  getRolePermissions,
  PERMISSIONS,
  publicJobCard,
  requireStaff,
} from "./lib";
import { publicProposalAttachment } from "./proposalAttachments";

const COMMAND_CENTER_ROW_LIMIT = 200;

type ChecklistTaskFields = Pick<
  Doc<"checklistTasks">,
  "category" | "completed" | "dueDate" | "ownerRole" | "title"
>;
type CommandCenterChecklistTask =
  | (ChecklistTaskFields & Pick<Doc<"checklistTasks">, "_id">)
  | (ChecklistTaskFields & { legacyKey: string });

type CommandCenterSectionKey =
  | "checklist"
  | "finance"
  | "hotels"
  | "passports"
  | "tickets"
  | "tourManager"
  | "travellers"
  | "visas";

type MoneyReadiness =
  | "awaiting_payment"
  | "not_started"
  | "partially_outstanding"
  | "ready"
  | "review_required";

interface BoundedRows<Row> {
  rows: Row[];
  truncated: boolean;
}

async function boundedRows<Row>(query: { take: (limit: number) => Promise<Row[]> }) {
  const rows = await query.take(COMMAND_CENTER_ROW_LIMIT + 1);
  return {
    rows: rows.slice(0, COMMAND_CENTER_ROW_LIMIT),
    truncated: rows.length > COMMAND_CENTER_ROW_LIMIT,
  } satisfies BoundedRows<Row>;
}

function publicOperationalProposalSummary(
  proposal: Doc<"proposals">,
  attachments: Doc<"proposalAttachments">[] = []
) {
  return {
    attachments: attachments
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(publicProposalAttachment),
    clientName: proposal.clientName ?? "",
    finalizedPdf: proposal.finalizedPdfStorageId
      ? {
          fileName: proposal.finalizedPdfFileName ?? "proposal.pdf",
          uploadedAt: proposal.finalizedPdfUploadedAt
            ? new Date(proposal.finalizedPdfUploadedAt).toISOString()
            : null,
        }
      : null,
    id: proposal._id,
    itinerarySummary: proposal.itinerarySummary ?? "",
    proposalCode: proposal.proposalCode,
    status: proposal.status,
  };
}

function invoiceHasValidMoney(invoice: Doc<"invoices">) {
  const totalsReconcile =
    Math.round((invoice.receivedAmount + invoice.balanceAmount) * 100) ===
    Math.round(invoice.expectedAmount * 100);
  return (
    Number.isFinite(invoice.balanceAmount) &&
    invoice.balanceAmount >= 0 &&
    Number.isFinite(invoice.expectedAmount) &&
    invoice.expectedAmount >= 0 &&
    Number.isFinite(invoice.receivedAmount) &&
    invoice.receivedAmount >= 0 &&
    invoice.receivedAmount <= invoice.expectedAmount &&
    invoice.balanceAmount <= invoice.expectedAmount &&
    totalsReconcile
  );
}

export function projectJobCardMoney(
  invoices: Doc<"invoices">[],
  canViewExactFinance: boolean,
  truncated = false
) {
  const issuedInvoices = invoices.filter((invoice) => invoice.status !== "Draft");
  let readiness: MoneyReadiness = "not_started";
  if (truncated || invoices.some((invoice) => !invoiceHasValidMoney(invoice))) {
    readiness = "review_required";
  } else if (issuedInvoices.length > 0) {
    const outstanding = issuedInvoices.filter((invoice) => invoice.balanceAmount > 0);
    if (outstanding.length === 0) {
      readiness = "ready";
    } else if (
      issuedInvoices.some(
        (invoice) => invoice.receivedAmount > 0 || invoice.balanceAmount < invoice.expectedAmount
      )
    ) {
      readiness = "partially_outstanding";
    } else {
      readiness = "awaiting_payment";
    }
  }
  return {
    exact: canViewExactFinance
      ? {
          invoices: invoices.map((invoice) => ({
            balanceAmount: invoice.balanceAmount,
            expectedAmount: invoice.expectedAmount,
            id: invoice._id,
            invoiceNumber: invoice.invoiceNumber,
            receivedAmount: invoice.receivedAmount,
            status: invoice.status,
          })),
          truncated,
        }
      : null,
    readiness,
  };
}

const CURRENT_VARIANCE_FIELDS = [
  "clientName",
  "confirmedPax",
  "destination",
  "roomCount",
  "travelEndDate",
  "travelStartDate",
] as const;

export function projectJobCardOpeningEvidence(job: Doc<"jobCards">, canViewExactFinance: boolean) {
  const snapshot = job.openingSnapshot;
  if (!snapshot) {
    return {
      authority: null,
      commercial: null,
      current: { observedAt: job.updatedAt, variances: [] },
      effective: null,
      openedAt: null,
      openedByStaffId: null,
      source: null,
      status: "unknown" as const,
      variances: [],
      version: null,
    };
  }
  const current = {
    clientName: job.clientName,
    confirmedPax: job.confirmedPax,
    destination: job.destination ?? "",
    roomCount: job.roomCount ?? 0,
    travelEndDate: job.travelEndDate ?? "",
    travelStartDate: job.travelStartDate ?? "",
  };
  const currentVariances = CURRENT_VARIANCE_FIELDS.flatMap((field) => {
    const openingValue = String(snapshot.effective[field]);
    const currentValue = String(current[field]);
    return openingValue === currentValue ? [] : [{ currentValue, field, openingValue }];
  });
  return {
    authority: snapshot.authority,
    commercial: canViewExactFinance ? snapshot.commercial : null,
    current: { observedAt: job.updatedAt, variances: currentVariances },
    effective: snapshot.effective,
    openedAt: snapshot.openedAt,
    openedByStaffId: snapshot.openedByStaffId,
    source: snapshot.source,
    status: "recorded" as const,
    variances: snapshot.variances,
    version: snapshot.version,
  };
}

function percentage(done: number, total: number) {
  return total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
}

function readinessSection(
  key: CommandCenterSectionKey,
  label: string,
  done: number,
  total: number,
  truncated = false
) {
  return {
    complete: !truncated && total > 0 && done >= total,
    coverage: truncated ? ("partial" as const) : ("complete" as const),
    done,
    key,
    label,
    percent: truncated ? 0 : percentage(done, total),
    total,
  };
}

export function buildJobCardReadiness({
  checklistTasks,
  hotels,
  job,
  moneyReadiness,
  rooming,
  tickets,
  tourManagerAssigned,
  travellers,
  truncated,
  visaRecords,
}: {
  checklistTasks: CommandCenterChecklistTask[];
  hotels: Pick<Doc<"hotels">, "_id">[];
  job: Doc<"jobCards">;
  moneyReadiness: MoneyReadiness;
  rooming: Pick<Doc<"roomingListEntries">, "_id">[];
  tickets: Pick<Doc<"tickets">, "ticketStatus">[];
  tourManagerAssigned: boolean;
  travellers: Pick<Doc<"travellers">, "passportStatus">[];
  truncated: Record<Exclude<CommandCenterSectionKey, "finance" | "tourManager">, boolean>;
  visaRecords: Pick<Doc<"visaRecords">, "status">[];
}) {
  const travellerTotal = Math.max(travellers.length, job.confirmedPax);
  return [
    readinessSection(
      "travellers",
      "Traveller master",
      travellers.length,
      travellerTotal,
      truncated.travellers
    ),
    readinessSection(
      "passports",
      "Passports",
      travellers.filter((row) => row.passportStatus === "Received").length,
      travellerTotal,
      truncated.passports
    ),
    readinessSection(
      "visas",
      "Visas",
      visaRecords.filter((row) => row.status === "Approved" || row.status === "Not Required")
        .length,
      Math.max(visaRecords.length, travellerTotal),
      truncated.visas
    ),
    job.ticketingRequired === false
      ? {
          complete: true,
          coverage: "complete" as const,
          done: 0,
          key: "tickets" as const,
          label: "Tickets — not required",
          percent: 100,
          total: 0,
        }
      : readinessSection(
          "tickets",
          "Tickets",
          tickets.filter((row) => row.ticketStatus === "Issued").length,
          Math.max(tickets.length, travellerTotal),
          truncated.tickets
        ),
    readinessSection(
      "hotels",
      "Hotels/rooming",
      rooming.length || hotels.length,
      travellerTotal,
      truncated.hotels
    ),
    readinessSection("tourManager", "Tour manager", tourManagerAssigned ? 1 : 0, 1),
    readinessSection("finance", "Finance/payment", moneyReadiness === "ready" ? 1 : 0, 1),
    readinessSection(
      "checklist",
      "Checklist tasks",
      checklistTasks.filter((row) => row.completed).length,
      checklistTasks.length,
      truncated.checklist
    ),
  ];
}

const SECTION_ACTIONS = {
  checklist: {
    label: "Review checklist tasks",
    permission: PERMISSIONS.VIEW_JOB_CARDS,
    route: "job-card",
  },
  finance: {
    label: "Review payment readiness",
    permission: PERMISSIONS.VIEW_FINANCE,
    route: "/portal/finance",
  },
  hotels: {
    label: "Continue hotel and rooming work",
    permission: PERMISSIONS.VIEW_OPERATIONS,
    route: "/portal/hotels",
  },
  passports: {
    label: "Continue passport collection",
    permission: PERMISSIONS.VIEW_VISA,
    route: "/portal/passport",
  },
  tickets: {
    label: "Continue ticketing",
    permission: PERMISSIONS.VIEW_TICKETING,
    route: "/portal/tickets",
  },
  tourManager: {
    label: "Assign or review the Tour Manager",
    permission: PERMISSIONS.VIEW_TOUR_MANAGERS,
    route: "/portal/tour-managers",
  },
  travellers: {
    label: "Continue Traveller master",
    permission: PERMISSIONS.VIEW_TRAVELLERS,
    route: "/portal/travellers",
  },
  visas: {
    label: "Continue visa tracking",
    permission: PERMISSIONS.VIEW_VISA,
    route: "/portal/visa",
  },
} as const;

type ActionOwner =
  | { kind: "role"; label: string; staffId: null }
  | { kind: "staff"; label: string; staffId: string };

type CommandCenterOwners = Record<CommandCenterSectionKey, ActionOwner>;

function ownerForSection(key: CommandCenterSectionKey, owners: CommandCenterOwners): ActionOwner {
  return owners[key];
}

function scopedActionHref(route: string, jobCardId: string) {
  if (route === "job-card") {
    return `/portal/job-cards/${encodeURIComponent(jobCardId)}#checklist-tasks`;
  }
  return `${route}?jc=${encodeURIComponent(jobCardId)}`;
}

export function buildJobCardActions({
  jobCardId,
  owners,
  permissions,
  sections,
}: {
  jobCardId: string;
  owners: CommandCenterOwners;
  permissions: string[];
  sections: ReturnType<typeof buildJobCardReadiness>;
}) {
  const permissionSet = new Set(permissions);
  return sections.flatMap((section) => {
    if (section.complete) {
      return [];
    }
    const spec = SECTION_ACTIONS[section.key];
    const available = permissionSet.has(spec.permission);
    return [
      {
        href: available ? scopedActionHref(spec.route, jobCardId) : null,
        id: `readiness:${section.key}`,
        label: spec.label,
        owner: ownerForSection(section.key, owners),
        sectionKey: section.key,
        status: available ? ("available" as const) : ("owned_elsewhere" as const),
      },
    ];
  });
}

function loadAssignedOwner(ctx: QueryCtx, staffId: string | undefined) {
  const normalizedStaffId = staffId ? ctx.db.normalizeId("staffUsers", staffId) : null;
  return normalizedStaffId ? ctx.db.get("staffUsers", normalizedStaffId) : null;
}

function authorizedAssignedOwner(
  staff: Doc<"staffUsers"> | null,
  requiredPermission: string,
  fallbackRole: string
): ActionOwner {
  if (staff?.active && getRolePermissions(staff.roles).includes(requiredPermission)) {
    return { kind: "staff", label: staff.name, staffId: String(staff._id) };
  }
  return { kind: "role", label: fallbackRole, staffId: null };
}

async function commandCenterOwners(ctx: QueryCtx, job: Doc<"jobCards">) {
  const [operationsStaff, ticketingStaff, tourManagerStaff] = await Promise.all([
    loadAssignedOwner(ctx, job.operationsOwnerId),
    loadAssignedOwner(ctx, job.ticketingOwnerId),
    loadAssignedOwner(ctx, job.tourManagerStaffId ? String(job.tourManagerStaffId) : undefined),
  ]);
  return {
    checklist: authorizedAssignedOwner(operationsStaff, PERMISSIONS.VIEW_JOB_CARDS, "Operations"),
    finance: { kind: "role", label: "Finance", staffId: null } as const,
    hotels: authorizedAssignedOwner(operationsStaff, PERMISSIONS.VIEW_OPERATIONS, "Operations"),
    passports: authorizedAssignedOwner(operationsStaff, PERMISSIONS.VIEW_VISA, "Operations"),
    tickets: authorizedAssignedOwner(ticketingStaff, PERMISSIONS.VIEW_TICKETING, "Ticketing"),
    tourManager: authorizedAssignedOwner(
      tourManagerStaff,
      PERMISSIONS.VIEW_TOUR_MANAGERS,
      "Operations"
    ),
    travellers: authorizedAssignedOwner(operationsStaff, PERMISSIONS.VIEW_TRAVELLERS, "Operations"),
    visas: authorizedAssignedOwner(operationsStaff, PERMISSIONS.VIEW_VISA, "Operations"),
  } satisfies CommandCenterOwners;
}

export async function handleGetCommandCenter(
  ctx: QueryCtx,
  args: {
    jobCardId: string;
  }
) {
  const access = await requireStaff(ctx, PERMISSIONS.VIEW_JOB_CARDS);
  const jobCardId = ctx.db.normalizeId("jobCards", args.jobCardId);
  if (!jobCardId) {
    throw new ConvexError("Invalid Job Card id");
  }
  const job = await ctx.db.get("jobCards", jobCardId);
  if (!job) {
    throw new ConvexError("Job Card not found");
  }
  const linkedQuery = job.queryId ? await ctx.db.get("queries", job.queryId) : null;
  if (!canSeeJobCardRecord(access, job, linkedQuery)) {
    throw new ConvexError("FORBIDDEN");
  }
  const linkedProposalId = job.proposalId;
  const canViewExactFinance = access.permissions.includes(PERMISSIONS.VIEW_FINANCE);
  const [
    proposal,
    travellersPage,
    visaPage,
    ticketsPage,
    hotelsPage,
    roomingPage,
    invoicesPage,
    checklistPage,
    proposalAttachments,
    commercialFiles,
    owners,
    tourManagerAssignment,
  ] = await Promise.all([
    linkedProposalId ? ctx.db.get("proposals", linkedProposalId) : null,
    boundedRows(
      ctx.db.query("travellers").withIndex("by_jobCardId", (q) => q.eq("jobCardId", jobCardId))
    ),
    boundedRows(
      ctx.db.query("visaRecords").withIndex("by_jobCardId", (q) => q.eq("jobCardId", jobCardId))
    ),
    boundedRows(
      ctx.db.query("tickets").withIndex("by_jobCardId", (q) => q.eq("jobCardId", jobCardId))
    ),
    boundedRows(
      ctx.db.query("hotels").withIndex("by_jobCardId", (q) => q.eq("jobCardId", jobCardId))
    ),
    boundedRows(
      ctx.db
        .query("roomingListEntries")
        .withIndex("by_jobCardId", (q) => q.eq("jobCardId", jobCardId))
    ),
    boundedRows(
      ctx.db.query("invoices").withIndex("by_jobCardId", (q) => q.eq("jobCardId", jobCardId))
    ),
    getChecklistTasksWithFallback(ctx, job, COMMAND_CENTER_ROW_LIMIT + 1),
    linkedProposalId
      ? ctx.db
          .query("proposalAttachments")
          .withIndex("by_proposalId", (q) => q.eq("proposalId", linkedProposalId))
          .order("desc")
          .take(COMMAND_CENTER_ROW_LIMIT)
      : Promise.resolve([]),
    loadCommercialChainFilesForEntryPoint(ctx, "jobCard", String(jobCardId)),
    commandCenterOwners(ctx, job),
    job.tourManagerId ? ctx.db.get("tourManagerAssignments", job.tourManagerId) : null,
  ]);
  const checklistTruncated = checklistPage.length > COMMAND_CENTER_ROW_LIMIT;
  const checklistTasks = checklistPage.slice(0, COMMAND_CENTER_ROW_LIMIT);
  const money = projectJobCardMoney(invoicesPage.rows, canViewExactFinance, invoicesPage.truncated);
  const readiness = buildJobCardReadiness({
    checklistTasks,
    hotels: hotelsPage.rows,
    job,
    moneyReadiness: money.readiness,
    rooming: roomingPage.rows,
    tickets: ticketsPage.rows,
    tourManagerAssigned: Boolean(
      tourManagerAssignment?.jobCardId === jobCardId && tourManagerAssignment.status === "Assigned"
    ),
    travellers: travellersPage.rows,
    truncated: {
      checklist: checklistTruncated,
      hotels: hotelsPage.truncated || roomingPage.truncated || travellersPage.truncated,
      passports: travellersPage.truncated,
      tickets: ticketsPage.truncated || travellersPage.truncated,
      travellers: travellersPage.truncated,
      visas: visaPage.truncated || travellersPage.truncated,
    },
    visaRecords: visaPage.rows,
  });
  const actions = buildJobCardActions({
    jobCardId: String(jobCardId),
    owners,
    permissions: access.permissions,
    sections: readiness,
  });
  return {
    actions,
    blockers: readiness.flatMap((section) =>
      section.complete
        ? []
        : [
            {
              key: section.key,
              label:
                section.coverage === "partial"
                  ? `${section.label} needs review because the bounded snapshot is incomplete`
                  : `${section.label} incomplete`,
              severity:
                section.coverage === "partial" || section.percent < 50
                  ? ("critical" as const)
                  : ("warning" as const),
            },
          ]
    ),
    checklistTasks: checklistTasks.map((task: CommandCenterChecklistTask) => {
      const fields = {
        category: task.category,
        completed: task.completed,
        dueDate: task.dueDate,
        ownerRole: task.ownerRole,
        title: task.title,
      };
      if ("legacyKey" in task) {
        return { ...fields, legacyKey: task.legacyKey };
      }
      return { ...fields, _id: task._id };
    }),
    commercialFiles,
    jobCard: publicJobCard(job),
    money,
    openingEvidence: projectJobCardOpeningEvidence(job, canViewExactFinance),
    proposal: proposal ? publicOperationalProposalSummary(proposal, proposalAttachments) : null,
    query: linkedQuery
      ? {
          clientName: linkedQuery.clientName,
          contractingStatus: linkedQuery.contractingStatus,
          destination: linkedQuery.destination ?? "",
          id: linkedQuery._id,
          queryCode: linkedQuery.queryCode,
          salesStatus: linkedQuery.salesStatus,
        }
      : null,
    readiness,
  };
}
