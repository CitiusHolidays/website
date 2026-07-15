import { ConvexError } from "convex/values";
import type { Id } from "../../_generated/dataModel";
import { CEMENT_QUERY_TYPES, CEMENT_ROLES } from "./rolePolicy";
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

export function hasCementRole(access: PortalAccess) {
  return CEMENT_ROLES.some((role) => hasRole(access, role));
}

export function isCementQueryType(queryType?: string | null) {
  return CEMENT_QUERY_TYPES.includes(
    String(queryType ?? "") as (typeof CEMENT_QUERY_TYPES)[number]
  );
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

export type QueryVisibilityRecord = {
  _id?: Id<"queries">;
  queryType?: string | null;
  createdBy?: string | null;
  salesOwnerId?: string | null;
  salesOwnerName?: string | null;
  salesStatus?: string | null;
  contractingOwnerId?: string | null;
  contractingOwnerName?: string | null;
  contractingStatus?: string | null;
  ticketingOwnerId?: string | null;
  ticketingOwnerName?: string | null;
  ticketingScope?: string | null;
};

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
    ownsAuthRecord(access, query.salesOwnerId) ||
    ownsStaffRecord(access, query.contractingOwnerId) ||
    ownsStaffRecord(access, query.ticketingOwnerId) ||
    ownsNamedRecord(access, query.salesOwnerName) ||
    ownsNamedRecord(access, query.contractingOwnerName) ||
    ownsNamedRecord(access, query.ticketingOwnerName)
  );
}

export type ProposalVisibilityRecord = {
  createdBy?: string | null;
  preparedBy?: string | null;
  collaboratorStaffIds?: unknown[] | null;
  queryId?: Id<"queries"> | null;
  _id?: Id<"proposals">;
};

export function canSeeProposalRecord(
  access: PortalAccess,
  proposal: ProposalVisibilityRecord,
  linkedQuery?: QueryVisibilityRecord | QueryVisibilityRecord[] | null
) {
  const linkedQueries = Array.isArray(linkedQuery)
    ? linkedQuery.filter((query): query is QueryVisibilityRecord => Boolean(query))
    : linkedQuery
      ? [linkedQuery]
      : [];
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
    ownsNamedRecord(access, proposal.preparedBy) ||
    isCollaborator(access, proposal.collaboratorStaffIds) ||
    linkedQueries.some((query) => canSeeQueryRecord(access, query))
  );
}

export type JobCardVisibilityRecord = {
  createdBy?: string | null;
  queryType?: string | null;
  queryId?: Id<"queries"> | null;
  contractingOwnerId?: string | null;
  contractingOwnerName?: string | null;
  operationsOwnerId?: string | null;
  operationsOwnerName?: string | null;
  ticketingOwnerId?: string | null;
  ticketingOwnerName?: string | null;
  tourManagerName?: string | null;
  collaboratorStaffIds?: unknown[] | null;
  _id?: Id<"jobCards">;
};

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
    ownsStaffRecord(access, job.contractingOwnerId) ||
    ownsStaffRecord(access, job.operationsOwnerId) ||
    ownsStaffRecord(access, job.ticketingOwnerId) ||
    isCollaborator(access, job.collaboratorStaffIds) ||
    ownsNamedRecord(access, job.contractingOwnerName) ||
    ownsNamedRecord(access, job.operationsOwnerName) ||
    ownsNamedRecord(access, job.ticketingOwnerName) ||
    ownsNamedRecord(access, job.tourManagerName) ||
    (linkedQuery ? canSeeQueryRecord(access, linkedQuery) : false)
  );
}

export type ContractingEditRecord = {
  contractingOwnerId?: string | null;
  contractingOwnerName?: string | null;
  collaboratorStaffIds?: unknown[] | null;
};

export function canEditContractingRecord(access: PortalAccess, record: ContractingEditRecord) {
  return (
    isAdminDirectorOrRole(access, ["Contracting Head", "Operations Head"]) ||
    ownsStaffRecord(access, record.contractingOwnerId) ||
    ownsNamedRecord(access, record.contractingOwnerName) ||
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
  return linkedQueries.some(
    (query) =>
      ownsStaffRecord(access, query.ticketingOwnerId) ||
      ownsNamedRecord(access, query.ticketingOwnerName)
  );
}

export type OperationsEditRecord = {
  operationsOwnerId?: string | null;
  operationsOwnerName?: string | null;
  collaboratorStaffIds?: unknown[] | null;
};

export function canEditOperationsRecord(access: PortalAccess, record: OperationsEditRecord) {
  return (
    isAdminDirectorOrRole(access, ["Operations Head"]) ||
    ownsStaffRecord(access, record.operationsOwnerId) ||
    ownsNamedRecord(access, record.operationsOwnerName) ||
    isCollaborator(access, record.collaboratorStaffIds)
  );
}

export function editorPatch(access: PortalAccess, timestamp = Date.now()) {
  return {
    lastEditedAt: timestamp,
    lastEditedBy: access.authUserId ?? access.email ?? "unknown",
    lastEditedByName: access.name,
    updatedAt: timestamp,
  };
}

type JobCardLinkedRecord = JobCardVisibilityRecord & { jobCardId?: Id<"jobCards"> | null };

export type CementPortalRecords<
  TQuery extends QueryVisibilityRecord = QueryVisibilityRecord,
  TProposal extends ProposalVisibilityRecord = ProposalVisibilityRecord,
  TJob extends JobCardVisibilityRecord = JobCardVisibilityRecord,
  TTraveller extends JobCardLinkedRecord = JobCardLinkedRecord,
  TTicket extends JobCardLinkedRecord = JobCardLinkedRecord,
  TVisa extends JobCardLinkedRecord = JobCardLinkedRecord,
  TInvoice extends JobCardLinkedRecord = JobCardLinkedRecord,
> = {
  queries: TQuery[];
  proposals: TProposal[];
  jobCards: TJob[];
  travellers: TTraveller[];
  tickets: TTicket[];
  visas: TVisa[];
  invoices: TInvoice[];
  proposalQueryLinks?: Array<{ proposalId: Id<"proposals">; queryId: Id<"queries"> }>;
};

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
