export const AUTH_IDENTITY_MIGRATION_VERSION = 1;

export interface AuthIdentityFieldSpec {
  fields: readonly string[];
  indexes: readonly string[];
  table: string;
  uniqueKey?: { fields: readonly string[]; index: string };
}

/**
 * Stored auth principals and Staff-writer audit fields. Relationship fields
 * that hold Convex staff document IDs are deliberately excluded.
 */
export const AUTH_IDENTITY_FIELD_SPECS = [
  { fields: ["actorId"], indexes: [], table: "activityLogs" },
  { fields: ["createdBy"], indexes: [], table: "additionalServices" },
  { fields: ["decidedBy", "requestedBy"], indexes: [], table: "approvalRequests" },
  { fields: ["createdBy"], indexes: [], table: "attachments" },
  { fields: ["userId"], indexes: ["by_userId_createdAt"], table: "bookings" },
  { fields: ["createdBy"], indexes: [], table: "checklistTasks" },
  { fields: ["createdBy", "deletedBy"], indexes: [], table: "commercialFiles" },
  {
    fields: ["authUserId"],
    indexes: ["by_authUserId_createdAt"],
    table: "commercialFileUploadSessions",
  },
  {
    fields: ["authUserId"],
    indexes: [
      "by_authUserId_createdAt",
      "by_bookingId_authUserId",
      "by_confirmedOfferId_authUserId",
      "by_queryId_authUserId",
    ],
    table: "customerJourneyEntitlements",
  },
  { fields: ["createdBy"], indexes: [], table: "confirmedOffers" },
  { fields: ["createdBy"], indexes: [], table: "contractingAssignments" },
  { fields: ["initiatedBy"], indexes: [], table: "crmImportBatches" },
  { fields: ["initiatedBy"], indexes: [], table: "passengerImportOperations" },
  { fields: ["initiatedBy"], indexes: [], table: "passengerExportOperations" },
  { fields: ["createdBy"], indexes: [], table: "eventFlows" },
  {
    fields: ["createdBy", "financeReviewedBy", "managerReviewedBy"],
    indexes: [],
    table: "expenseEntries",
  },
  { fields: ["createdBy"], indexes: [], table: "flightGroups" },
  { fields: ["createdBy"], indexes: [], table: "flightSegments" },
  { fields: ["createdBy"], indexes: [], table: "hotels" },
  { fields: ["createdBy"], indexes: [], table: "invoices" },
  { fields: ["createdBy"], indexes: [], table: "itineraries" },
  {
    fields: ["actorKey"],
    indexes: ["by_actorKey_operation_commandId"],
    table: "commandReceipts",
    uniqueKey: {
      fields: ["actorKey", "operation", "commandId"],
      index: "by_actorKey_operation_commandId",
    },
  },
  { fields: ["initiatedBy"], indexes: [], table: "jobCardDeletionOperations" },
  { fields: ["createdBy", "lastEditedBy"], indexes: [], table: "jobCards" },
  {
    fields: ["recipientUserId"],
    indexes: ["by_recipientUserId_createdAt"],
    table: "notifications",
  },
  {
    fields: ["authUserId"],
    indexes: ["by_authUserId", "by_notification_user"],
    table: "notificationReads",
    uniqueKey: {
      fields: ["notificationId", "authUserId"],
      index: "by_notification_user",
    },
  },
  { fields: ["createdBy"], indexes: [], table: "passportDetails" },
  { fields: ["createdBy"], indexes: [], table: "pnrs" },
  {
    fields: ["createdBy", "ownerAuthUserId"],
    indexes: ["by_ownerAuthUserId"],
    table: "portalSavedViews",
  },
  {
    fields: ["authUserId"],
    indexes: ["by_authUserId"],
    table: "portalFileDownloadRateLimits",
  },
  { fields: ["createdBy"], indexes: [], table: "proposalAttachments" },
  {
    fields: ["createdBy", "queryCreatedBy", "salesOwnerId"],
    indexes: [],
    table: "proposalQueryLinks",
  },
  { fields: ["handedOffBy"], indexes: [], table: "proposalQueryHandoffs" },
  {
    fields: ["createdBy", "finalizedPdfUploadedBy", "lastEditedBy"],
    indexes: [],
    table: "proposals",
  },
  { fields: ["createdBy", "salesOwnerId"], indexes: [], table: "queries" },
  { fields: ["createdBy"], indexes: [], table: "queryAttachments" },
  { fields: ["createdBy"], indexes: [], table: "roomingListEntries" },
  {
    fields: ["authUserId"],
    indexes: ["by_authUserId", "by_groupId_authUserId"],
    table: "sacredBharatGroupMembers",
    uniqueKey: {
      fields: ["groupId", "authUserId"],
      index: "by_groupId_authUserId",
    },
  },
  {
    fields: ["authUserId"],
    indexes: ["by_authUserId", "by_score"],
    table: "sacredBharatLeaderboardSummaries",
    uniqueKey: { fields: ["authUserId"], index: "by_authUserId" },
  },
  {
    fields: ["ownerAuthUserId"],
    indexes: ["by_ownerAuthUserId"],
    table: "sacredBharatGroups",
  },
  {
    fields: ["authUserId"],
    indexes: ["by_authUserId"],
    table: "sacredBharatInviteAttempts",
    uniqueKey: { fields: ["authUserId"], index: "by_authUserId" },
  },
  {
    fields: ["authUserId"],
    indexes: ["by_authUserId", "by_slug"],
    table: "sacredBharatProfiles",
    uniqueKey: { fields: ["authUserId"], index: "by_authUserId" },
  },
  {
    fields: ["authUserId"],
    indexes: ["by_authUserId", "by_authUserId_templeId"],
    table: "sacredBharatVisits",
    uniqueKey: {
      fields: ["authUserId", "templeId"],
      index: "by_authUserId_templeId",
    },
  },
  {
    fields: ["authUserId"],
    indexes: ["by_authUserId", "by_authUserId_item"],
    table: "sacredBharatWishlist",
    uniqueKey: {
      fields: ["authUserId", "itemType", "itemId"],
      index: "by_authUserId_item",
    },
  },
  { fields: ["createdBy"], indexes: [], table: "seatAllocations" },
  { fields: ["createdBy"], indexes: [], table: "staffLeaveLedger" },
  {
    fields: ["createdBy", "finalReviewedBy", "headReviewedBy", "hrReviewedBy"],
    indexes: [],
    table: "staffLeaveRecords",
  },
  {
    fields: ["authUserId", "invitedBy"],
    indexes: ["by_authUserId"],
    table: "staffUsers",
    uniqueKey: { fields: ["authUserId"], index: "by_authUserId" },
  },
  { fields: ["createdBy"], indexes: [], table: "tickets" },
  { fields: ["createdBy"], indexes: [], table: "tourManagerAssignments" },
  { fields: ["createdBy", "lastEditedBy"], indexes: [], table: "travelBatches" },
  { fields: ["createdBy"], indexes: [], table: "travellers" },
  {
    fields: ["archivedAuthUserId", "authUserId"],
    indexes: ["by_authUserId"],
    table: "userProfiles",
    uniqueKey: { fields: ["authUserId"], index: "by_authUserId" },
  },
  { fields: ["createdBy"], indexes: [], table: "vendors" },
  { fields: ["updatedBy"], indexes: [], table: "visaRecords" },
] as const satisfies readonly AuthIdentityFieldSpec[];

/** Materialized keys must be rebuilt after their base identity rows change. */
export const AUTH_IDENTITY_DERIVED_REBUILDS = [
  {
    sourceTables: ["notifications", "notificationReads"],
    tables: [
      "notificationTargetCounts",
      "notificationReadTargetCounts",
      "notificationUnreadProjectionReadiness",
    ],
  },
] as const;

const NON_IDENTITY_MARKERS = new Set([
  "bulk-import",
  "developer",
  "integration",
  "migration",
  "staff-workbook",
  "system",
  "unknown",
]);

export interface IdentityLinkSnapshot {
  canonicalAuthUserId: string;
  legacyAuthUserId: string;
  status: "linked" | "quarantined";
}

export type IdentityValueDisposition =
  | { kind: "canonical_or_marker" }
  | { canonicalAuthUserId: string; kind: "convert" }
  | { kind: "quarantine" }
  | { kind: "remaining" };

export function classifyStoredIdentity(
  value: unknown,
  links: readonly IdentityLinkSnapshot[]
): IdentityValueDisposition {
  if (typeof value !== "string" || !value.trim()) {
    return { kind: "canonical_or_marker" };
  }
  const identity = value.trim();
  if (NON_IDENTITY_MARKERS.has(identity) || identity.includes("|")) {
    return { kind: "canonical_or_marker" };
  }
  const candidates = links.filter((link) => link.legacyAuthUserId === identity);
  if (candidates.some((link) => link.status !== "linked")) {
    return { kind: "quarantine" };
  }
  const canonicalIds = [...new Set(candidates.map((link) => link.canonicalAuthUserId))];
  if (canonicalIds.length > 1) {
    return { kind: "quarantine" };
  }
  const [canonicalAuthUserId] = canonicalIds;
  return canonicalAuthUserId ? { canonicalAuthUserId, kind: "convert" } : { kind: "remaining" };
}

export function authIdentityMigrationRegistryKey(table: string, dryRun: boolean) {
  return `auth-identity-v${AUTH_IDENTITY_MIGRATION_VERSION}:${table}${dryRun ? ":dry-run" : ""}`;
}
