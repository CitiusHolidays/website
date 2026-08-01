import {
  canEditOperationsRecord,
  canEditProposalRecord,
  canSeeJobCardRecord,
  canSeeProposalRecord,
  canSeeQueryRecord,
  hasRole,
  isCollaborator,
  isDirectorOrAdmin,
  ownsNamedRecord,
  ownsStaffRecord,
  PERMISSIONS,
  type PortalAccess,
} from "./lib";

export const COMMERCIAL_FILE_CATEGORIES = ["workingFile", "proposalDoc"] as const;
export type CommercialFileCategory = (typeof COMMERCIAL_FILE_CATEGORIES)[number];

export const COMMERCIAL_FILE_SOURCE_TYPES = ["query", "proposal", "jobCard"] as const;
export type CommercialFileSourceType = (typeof COMMERCIAL_FILE_SOURCE_TYPES)[number];

export const COMMERCIAL_FILE_TEAM_AREAS = [
  "sales",
  "contracting",
  "ticketing",
  "accounts",
  "operations",
  "tourManager",
] as const;
export type CommercialFileTeamArea = (typeof COMMERCIAL_FILE_TEAM_AREAS)[number];

export const COMMERCIAL_FILE_TEAM_LABELS: Record<CommercialFileTeamArea, string> = {
  accounts: "Accounts",
  contracting: "Contracting",
  operations: "Operations",
  sales: "Sales",
  ticketing: "Ticketing",
  tourManager: "Tour Manager",
};

export const COMMERCIAL_FILE_RETENTION_MS = 14 * 24 * 60 * 60 * 1000;

interface QuerySource {
  sourceType: "query";
  query: {
    contractingOwnerId?: string | null;
    contractingOwnerName?: string | null;
    createdBy?: string | null;
    queryType?: string | null;
    salesOwnerId?: string | null;
    salesOwnerName?: string | null;
    ticketingOwnerId?: string | null;
    ticketingOwnerName?: string | null;
  };
}

interface ProposalSource {
  sourceType: "proposal";
  linkedQueries: Array<{
    contractingOwnerId?: string | null;
    contractingOwnerName?: string | null;
    queryType?: string | null;
    ticketingOwnerId?: string | null;
    ticketingOwnerName?: string | null;
  }>;
  proposal: {
    collaboratorStaffIds?: unknown[] | null;
    createdBy?: string | null;
    preparedBy?: string | null;
  };
}

interface JobCardSource {
  sourceType: "jobCard";
  jobCard: {
    collaboratorStaffIds?: unknown[] | null;
    contractingOwnerId?: string | null;
    contractingOwnerName?: string | null;
    createdBy?: string | null;
    operationsOwnerId?: string | null;
    operationsOwnerName?: string | null;
    ticketingOwnerId?: string | null;
    ticketingOwnerName?: string | null;
    tourManagerName?: string | null;
  };
  linkedQuery?: { queryType?: string | null } | null;
}

export type CommercialFileSource = QuerySource | ProposalSource | JobCardSource;

export function isProposalDocCategory(category: CommercialFileCategory) {
  return category === "proposalDoc";
}

export function defaultTeamAreaForSource(
  sourceType: CommercialFileSourceType
): CommercialFileTeamArea {
  if (sourceType === "query") {
    return "sales";
  }
  if (sourceType === "proposal") {
    return "contracting";
  }
  return "operations";
}

function hasAnyRole(access: PortalAccess, roles: string[]) {
  return roles.some((role) => hasRole(access, role));
}

function writableQueryAreas(access: PortalAccess, source: QuerySource): CommercialFileTeamArea[] {
  const canManage = access.permissions.includes(PERMISSIONS.MANAGE_QUERIES);
  const isSalesTeam = hasAnyRole(access, ["Sales", "Sales Head", "Sales Cement"]);
  if (!(canManage && (isSalesTeam || isDirectorOrAdmin(access)))) {
    return [];
  }
  if (!(isDirectorOrAdmin(access) || canSeeQueryRecord(access, source.query))) {
    return [];
  }
  return ["sales"];
}

function canEditTicketingJobCard(access: PortalAccess, job: JobCardSource["jobCard"]) {
  return (
    isDirectorOrAdmin(access) ||
    hasRole(access, "Head of Ticketing") ||
    ownsStaffRecord(access, job.ticketingOwnerId) ||
    ownsNamedRecord(access, job.ticketingOwnerName) ||
    isCollaborator(access, job.collaboratorStaffIds)
  );
}

function writableProposalAreas(
  access: PortalAccess,
  source: ProposalSource
): CommercialFileTeamArea[] {
  const hasEditPermission = [
    PERMISSIONS.MANAGE_PROPOSALS,
    PERMISSIONS.MANAGE_CONTRACTING,
    PERMISSIONS.MANAGE_TICKETING,
  ].some((permission) => access.permissions.includes(permission));
  if (
    !(hasEditPermission && canEditProposalRecord(access, source.proposal, source.linkedQueries))
  ) {
    return [];
  }
  const areas: CommercialFileTeamArea[] = [];
  if (
    hasAnyRole(access, ["Contracting", "Contracting Head", "Contracting Cement"]) ||
    isDirectorOrAdmin(access)
  ) {
    areas.push("contracting");
  }
  if (
    hasAnyRole(access, ["Ticketing", "Head of Ticketing"]) ||
    (isDirectorOrAdmin(access) && access.permissions.includes(PERMISSIONS.MANAGE_TICKETING))
  ) {
    areas.push("ticketing");
  }
  return areas;
}

function writableJobCardAreas(
  access: PortalAccess,
  source: JobCardSource
): CommercialFileTeamArea[] {
  const areas: CommercialFileTeamArea[] = [];
  if (
    (hasAnyRole(access, ["Accounts", "Accounts Head"]) || isDirectorOrAdmin(access)) &&
    access.permissions.includes(PERMISSIONS.MANAGE_JOB_CARDS)
  ) {
    areas.push("accounts");
  }
  if (
    (hasAnyRole(access, ["Operations", "Operations Head", "Operations Cement"]) ||
      isDirectorOrAdmin(access)) &&
    access.permissions.includes(PERMISSIONS.MANAGE_OPERATIONS) &&
    canEditOperationsRecord(access, source.jobCard)
  ) {
    areas.push("operations");
  }
  if (
    (hasAnyRole(access, ["Ticketing", "Head of Ticketing"]) || isDirectorOrAdmin(access)) &&
    access.permissions.includes(PERMISSIONS.MANAGE_TICKETING) &&
    canEditTicketingJobCard(access, source.jobCard)
  ) {
    areas.push("ticketing");
  }
  if (hasRole(access, "Tour Manager") && ownsNamedRecord(access, source.jobCard.tourManagerName)) {
    areas.push("tourManager");
  }
  return areas;
}

export function writableTeamAreasForSource(
  access: PortalAccess,
  source: CommercialFileSource
): CommercialFileTeamArea[] {
  if (source.sourceType === "query") {
    return writableQueryAreas(access, source);
  }
  if (source.sourceType === "proposal") {
    return writableProposalAreas(access, source);
  }
  return writableJobCardAreas(access, source);
}

export function canManageCommercialSource(
  access: PortalAccess,
  source: CommercialFileSource,
  teamArea: CommercialFileTeamArea
) {
  return writableTeamAreasForSource(access, source).includes(teamArea);
}

export function canReadCommercialSource(access: PortalAccess, source: CommercialFileSource) {
  if (source.sourceType === "query") {
    return canSeeQueryRecord(access, source.query);
  }
  if (source.sourceType === "proposal") {
    return canSeeProposalRecord(access, source.proposal, source.linkedQueries);
  }
  return canSeeJobCardRecord(access, source.jobCard, source.linkedQuery);
}

export function shouldAllowHistoryOverride(access: PortalAccess) {
  return isDirectorOrAdmin(access);
}

export function teamAreaLabel(teamArea: CommercialFileTeamArea) {
  return COMMERCIAL_FILE_TEAM_LABELS[teamArea];
}
