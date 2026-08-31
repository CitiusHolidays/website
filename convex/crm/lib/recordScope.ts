import { ConvexError } from "convex/values";
import type { Id } from "../../_generated/dataModel";
import { CEMENT_QUERY_TYPES, CEMENT_ROLES, PERMISSIONS } from "./rolePolicy";
import {
  hasRole,
  isAdminDirectorOrRole,
  isDirectorOrAdmin,
  type PortalAccess,
} from "./staffAccess";

export function canSeeAllPortalRecords(access: PortalAccess) {
  return isDirectorOrAdmin(access);
}

export function canSeeDepartmentRecords(access: PortalAccess, headRoles: string[] = []) {
  return canSeeAllPortalRecords(access) || headRoles.some((role) => hasRole(access, role));
}

export function ownsAuthRecord(access: PortalAccess, ownerId?: string | null) {
  return Boolean(ownerId && access.authUserId && ownerId === access.authUserId);
}

export function ownsStaffRecord(access: PortalAccess, ownerId?: string | null) {
  return Boolean(ownerId && access.staffId && ownerId === access.staffId);
}

export function isCollaborator(access: PortalAccess, collaboratorStaffIds?: unknown[] | null) {
  if (!(access.staffId && Array.isArray(collaboratorStaffIds))) {
    return false;
  }
  return collaboratorStaffIds.some((staffId) => String(staffId) === String(access.staffId));
}

export function ownsNamedRecord(access: PortalAccess, ownerName?: string | null) {
  return Boolean(ownerName && ownerName.trim().toLowerCase() === access.name.trim().toLowerCase());
}

/**
 * Transitional assignment boundary: a display snapshot is consulted only
 * when the row has no stable Staff owner. Name-authority removal remains a
 * separately gated cutover after the residual verifier reaches zero.
 */
export function ownsStaffAssignment(
  access: PortalAccess,
  ownerId?: string | null,
  ownerName?: string | null
) {
  return ownerId?.trim() ? ownsStaffRecord(access, ownerId) : ownsNamedRecord(access, ownerName);
}

/**
 * Sales rows historically stored an auth subject in the field now owned by a
 * Staff id. New writers use Staff ids; issuer-qualified auth matching remains
 * only as migration compatibility and never enables the name fallback.
 */
export function ownsSalesAssignment(
  access: PortalAccess,
  ownerId?: string | null,
  ownerName?: string | null
) {
  return ownerId?.trim()
    ? ownsStaffRecord(access, ownerId) || ownsAuthRecord(access, ownerId)
    : ownsNamedRecord(access, ownerName);
}

export function hasCementRole(access: PortalAccess) {
  return CEMENT_ROLES.some((role) => hasRole(access, role));
}

export function isCementQueryType(queryType?: string | null) {
  return CEMENT_QUERY_TYPES.some((candidate) => candidate === String(queryType ?? ""));
}

export function shouldApplyCementScope(access: PortalAccess) {
  return hasCementRole(access) && !isDirectorOrAdmin(access);
}

export function canSeeAllCementRecords(access: PortalAccess) {
  return shouldApplyCementScope(access) && hasRole(access, "Director Cement");
}

export function assertCementQueryTypeAllowed(access: PortalAccess, queryType: string) {
  if (shouldApplyCementScope(access) && !isCementQueryType(queryType)) {
    throw new ConvexError("Cement roles can only work with Cement query types");
  }
}

export function contractingNotifyRolesForQueryType(queryType: string) {
  return isCementQueryType(queryType)
    ? ["Contracting", "Contracting Head", "Contracting Cement"]
    : ["Contracting", "Contracting Head"];
}

export interface QueryVisibilityRecord {
  _id?: Id<"queries">;
  contractingOwnerId?: string | null;
  contractingOwnerName?: string | null;
  contractingStatus?: string | null;
  createdBy?: string | null;
  queryType?: string | null;
  salesOwnerId?: string | null;
  salesOwnerName?: string | null;
  salesStatus?: string | null;
  ticketingOwnerId?: string | null;
  ticketingOwnerName?: string | null;
  ticketingScope?: string | null;
}

export function canSeeQueryRecord(access: PortalAccess, query: QueryVisibilityRecord) {
  if (shouldApplyCementScope(access)) {
    if (!isCementQueryType(query.queryType)) {
      return false;
    }
    if (canSeeAllCementRecords(access)) {
      return true;
    }
  } else {
    if (
      canSeeDepartmentRecords(access, [
        "Sales Head",
        "Contracting Head",
        "Operations Head",
        "Head of Ticketing",
        "Accounts Head",
      ])
    ) {
      return true;
    }
    if (
      (hasRole(access, "Accounts") ||
        hasRole(access, "Accounts Head") ||
        hasRole(access, "Finance")) &&
      (query.salesStatus === "Order Confirmed" || query.contractingStatus === "Order Confirmed")
    ) {
      return true;
    }
  }
  return (
    ownsAuthRecord(access, query.createdBy) ||
    ownsSalesAssignment(access, query.salesOwnerId, query.salesOwnerName) ||
    ownsStaffAssignment(access, query.contractingOwnerId, query.contractingOwnerName) ||
    ownsStaffAssignment(access, query.ticketingOwnerId, query.ticketingOwnerName)
  );
}

export interface ProposalVisibilityRecord {
  _id?: Id<"proposals">;
  collaboratorStaffIds?: unknown[] | null;
  createdBy?: string | null;
  preparedBy?: string | null;
  preparedByStaffId?: Id<"staffUsers"> | string | null;
  queryId?: Id<"queries"> | null;
}

export function canSeeProposalRecord(
  access: PortalAccess,
  proposal: ProposalVisibilityRecord,
  linkedQuery?: QueryVisibilityRecord | QueryVisibilityRecord[] | null
) {
  let linkedQueries: QueryVisibilityRecord[] = [];
  if (Array.isArray(linkedQuery)) {
    linkedQueries = linkedQuery.filter((query): query is QueryVisibilityRecord => Boolean(query));
  } else if (linkedQuery) {
    linkedQueries = [linkedQuery];
  }
  if (shouldApplyCementScope(access)) {
    const cementQueries = linkedQueries.filter((query) => isCementQueryType(query.queryType));
    if (cementQueries.length === 0) {
      return false;
    }
    if (canSeeAllCementRecords(access)) {
      return true;
    }
  } else {
    if (
      canSeeDepartmentRecords(access, [
        "Sales Head",
        "Contracting Head",
        "Operations Head",
        "Head of Ticketing",
        "Accounts Head",
      ])
    ) {
      return true;
    }
    if (
      (hasRole(access, "Accounts") || hasRole(access, "Accounts Head")) &&
      linkedQueries.some(
        (query) =>
          query.salesStatus === "Order Confirmed" || query.contractingStatus === "Order Confirmed"
      )
    ) {
      return true;
    }
  }
  return (
    ownsAuthRecord(access, proposal.createdBy) ||
    ownsStaffAssignment(access, proposal.preparedByStaffId, proposal.preparedBy) ||
    isCollaborator(access, proposal.collaboratorStaffIds) ||
    linkedQueries.some((query) => canSeeQueryRecord(access, query))
  );
}

export interface JobCardVisibilityRecord {
  _id?: Id<"jobCards">;
  collaboratorStaffIds?: unknown[] | null;
  contractingOwnerId?: string | null;
  contractingOwnerName?: string | null;
  createdBy?: string | null;
  operationsOwnerId?: string | null;
  operationsOwnerName?: string | null;
  queryId?: Id<"queries"> | null;
  queryType?: string | null;
  ticketingOwnerId?: string | null;
  ticketingOwnerName?: string | null;
  tourManagerName?: string | null;
  tourManagerStaffId?: Id<"staffUsers"> | string | null;
}

export function canSeeJobCardRecord(
  access: PortalAccess,
  job: JobCardVisibilityRecord,
  linkedQuery?: QueryVisibilityRecord | null
) {
  const queryType = linkedQuery?.queryType ?? job.queryType ?? "";
  if (shouldApplyCementScope(access)) {
    if (!isCementQueryType(queryType)) {
      return false;
    }
    if (canSeeAllCementRecords(access)) {
      return true;
    }
  } else if (
    canSeeDepartmentRecords(access, ["Contracting Head", "Operations Head", "Head of Ticketing"]) ||
    hasRole(access, "Accounts") ||
    hasRole(access, "Finance")
  ) {
    return true;
  }
  return (
    ownsAuthRecord(access, job.createdBy) ||
    ownsStaffAssignment(access, job.contractingOwnerId, job.contractingOwnerName) ||
    ownsStaffAssignment(access, job.operationsOwnerId, job.operationsOwnerName) ||
    ownsStaffAssignment(access, job.ticketingOwnerId, job.ticketingOwnerName) ||
    isCollaborator(access, job.collaboratorStaffIds) ||
    ownsStaffAssignment(access, job.tourManagerStaffId, job.tourManagerName) ||
    (linkedQuery ? canSeeQueryRecord(access, linkedQuery) : false)
  );
}

export interface ContractingEditRecord {
  collaboratorStaffIds?: unknown[] | null;
  contractingOwnerId?: string | null;
  contractingOwnerName?: string | null;
}

export function canEditContractingRecord(access: PortalAccess, record: ContractingEditRecord) {
  return (
    isAdminDirectorOrRole(access, ["Contracting Head", "Operations Head"]) ||
    ownsStaffAssignment(access, record.contractingOwnerId, record.contractingOwnerName) ||
    isCollaborator(access, record.collaboratorStaffIds)
  );
}

type ProposalEditQuery = ContractingEditRecord & {
  ticketingOwnerId?: string | null;
  ticketingOwnerName?: string | null;
};

export function canEditProposalRecord(
  access: PortalAccess,
  proposal: ContractingEditRecord,
  linkedQueries: ProposalEditQuery[] = []
) {
  if (canEditContractingRecord(access, proposal)) {
    return true;
  }
  if (linkedQueries.some((query) => canEditContractingRecord(access, query))) {
    return true;
  }
  return linkedQueries.some((query) =>
    ownsStaffAssignment(access, query.ticketingOwnerId, query.ticketingOwnerName)
  );
}

export interface OperationsEditRecord {
  collaboratorStaffIds?: unknown[] | null;
  operationsOwnerId?: string | null;
  operationsOwnerName?: string | null;
}

export function canEditOperationsRecord(access: PortalAccess, record: OperationsEditRecord) {
  return (
    isAdminDirectorOrRole(access, ["Operations Head"]) ||
    ownsStaffAssignment(access, record.operationsOwnerId, record.operationsOwnerName) ||
    isCollaborator(access, record.collaboratorStaffIds)
  );
}

export function editorPatch(access: PortalAccess, timestamp = Date.now()) {
  return {
    lastEditedAt: timestamp,
    lastEditedBy: access.authUserId ?? access.email,
    lastEditedByName: access.name,
    updatedAt: timestamp,
  };
}

interface JobCardLinkedRecord {
  jobCardId?: Id<"jobCards"> | null;
}

export interface CementPortalRecords<
  TQuery extends QueryVisibilityRecord = QueryVisibilityRecord,
  TProposal extends ProposalVisibilityRecord = ProposalVisibilityRecord,
  TJob extends JobCardVisibilityRecord = JobCardVisibilityRecord,
  TTraveller extends JobCardLinkedRecord = JobCardLinkedRecord,
  TTicket extends JobCardLinkedRecord = JobCardLinkedRecord,
  TVisa extends JobCardLinkedRecord = JobCardLinkedRecord,
  TInvoice extends JobCardLinkedRecord = JobCardLinkedRecord,
> {
  invoices: TInvoice[];
  jobCards: TJob[];
  proposalQueryLinks?: Array<{ proposalId: Id<"proposals">; queryId: Id<"queries"> }>;
  proposals: TProposal[];
  queries: TQuery[];
  tickets: TTicket[];
  travellers: TTraveller[];
  visas: TVisa[];
}

export function applyPortalRecordScope<
  TQuery extends QueryVisibilityRecord,
  TProposal extends ProposalVisibilityRecord,
  TJob extends JobCardVisibilityRecord,
  TTraveller extends JobCardLinkedRecord,
  TTicket extends JobCardLinkedRecord,
  TVisa extends JobCardLinkedRecord,
  TInvoice extends JobCardLinkedRecord,
>(
  access: PortalAccess,
  records: CementPortalRecords<TQuery, TProposal, TJob, TTraveller, TTicket, TVisa, TInvoice>
): CementPortalRecords<TQuery, TProposal, TJob, TTraveller, TTicket, TVisa, TInvoice> {
  const permissionSet = new Set(access.permissions);
  const queryById = new Map(records.queries.map((query) => [String(query._id), query]));
  const proposalLinksByProposalId = new Map<string, TQuery[]>();
  for (const link of records.proposalQueryLinks ?? []) {
    const linkedQuery = queryById.get(String(link.queryId));
    if (!linkedQuery) {
      continue;
    }
    const bucket = proposalLinksByProposalId.get(String(link.proposalId)) ?? [];
    bucket.push(linkedQuery);
    proposalLinksByProposalId.set(String(link.proposalId), bucket);
  }

  const visibleQueries = permissionSet.has(PERMISSIONS.VIEW_QUERIES)
    ? records.queries.filter((query) => canSeeQueryRecord(access, query))
    : [];
  const visibleJobCards = permissionSet.has(PERMISSIONS.VIEW_JOB_CARDS)
    ? records.jobCards.filter((job) => {
        const linkedQuery = job.queryId ? queryById.get(String(job.queryId)) : undefined;
        return canSeeJobCardRecord(access, job, linkedQuery);
      })
    : [];
  const visibleJobIds = new Set(visibleJobCards.map((job) => String(job._id)));
  const visibleProposals = permissionSet.has(PERMISSIONS.VIEW_PROPOSALS)
    ? records.proposals.filter((proposal) => {
        const linkedQueries = [...(proposalLinksByProposalId.get(String(proposal._id)) ?? [])];
        const legacyLinkedQuery = proposal.queryId
          ? queryById.get(String(proposal.queryId))
          : undefined;
        if (
          legacyLinkedQuery &&
          !linkedQueries.some((query) => String(query._id) === String(legacyLinkedQuery._id))
        ) {
          linkedQueries.push(legacyLinkedQuery);
        }
        return canSeeProposalRecord(access, proposal, linkedQueries);
      })
    : [];

  return {
    invoices: permissionSet.has(PERMISSIONS.VIEW_FINANCE)
      ? records.invoices.filter(
          (invoice) => !invoice.jobCardId || visibleJobIds.has(String(invoice.jobCardId))
        )
      : [],
    jobCards: visibleJobCards,
    proposals: visibleProposals,
    queries: visibleQueries,
    tickets: permissionSet.has(PERMISSIONS.VIEW_TICKETING)
      ? records.tickets.filter((ticket) => visibleJobIds.has(String(ticket.jobCardId)))
      : [],
    travellers: permissionSet.has(PERMISSIONS.VIEW_TRAVELLERS)
      ? records.travellers.filter((traveller) => visibleJobIds.has(String(traveller.jobCardId)))
      : [],
    visas: permissionSet.has(PERMISSIONS.VIEW_VISA)
      ? records.visas.filter((visa) => visibleJobIds.has(String(visa.jobCardId)))
      : [],
  };
}

export function applyCementPortalScope<
  TQuery extends QueryVisibilityRecord,
  TProposal extends ProposalVisibilityRecord,
  TJob extends JobCardVisibilityRecord,
  TTraveller extends JobCardLinkedRecord,
  TTicket extends JobCardLinkedRecord,
  TVisa extends JobCardLinkedRecord,
  TInvoice extends JobCardLinkedRecord,
>(
  access: PortalAccess,
  records: CementPortalRecords<TQuery, TProposal, TJob, TTraveller, TTicket, TVisa, TInvoice>
): CementPortalRecords<TQuery, TProposal, TJob, TTraveller, TTicket, TVisa, TInvoice> {
  if (!shouldApplyCementScope(access)) {
    return records;
  }

  const queryById = new Map(records.queries.map((query) => [String(query._id), query]));
  const proposalLinksByProposalId = new Map<string, TQuery[]>();
  for (const link of records.proposalQueryLinks ?? []) {
    const linkedQuery = queryById.get(String(link.queryId));
    if (!linkedQuery) {
      continue;
    }
    const bucket = proposalLinksByProposalId.get(String(link.proposalId)) ?? [];
    bucket.push(linkedQuery);
    proposalLinksByProposalId.set(String(link.proposalId), bucket);
  }
  const visibleQueries = records.queries.filter((query) => canSeeQueryRecord(access, query));
  const visibleJobCards = records.jobCards.filter((job) => {
    const linkedQuery = job.queryId ? queryById.get(String(job.queryId)) : undefined;
    return canSeeJobCardRecord(access, job, linkedQuery);
  });
  const visibleJobIds = new Set(visibleJobCards.map((job) => String(job._id)));
  const visibleProposals = records.proposals.filter((proposal) => {
    const linkedQueries = [...(proposalLinksByProposalId.get(String(proposal._id)) ?? [])];
    const legacyLinkedQuery = proposal.queryId
      ? queryById.get(String(proposal.queryId))
      : undefined;
    if (
      legacyLinkedQuery &&
      !linkedQueries.some((query) => String(query._id) === String(legacyLinkedQuery._id))
    ) {
      linkedQueries.push(legacyLinkedQuery);
    }
    return canSeeProposalRecord(access, proposal, linkedQueries);
  });

  return {
    invoices: records.invoices.filter(
      (invoice) => !invoice.jobCardId || visibleJobIds.has(String(invoice.jobCardId))
    ),
    jobCards: visibleJobCards,
    proposals: visibleProposals,
    queries: visibleQueries,
    tickets: records.tickets.filter((ticket) => visibleJobIds.has(String(ticket.jobCardId))),
    travellers: records.travellers.filter((traveller) =>
      visibleJobIds.has(String(traveller.jobCardId))
    ),
    visas: records.visas.filter((visa) => visibleJobIds.has(String(visa.jobCardId))),
  };
}
