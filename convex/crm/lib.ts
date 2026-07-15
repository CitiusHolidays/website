/**
 * Compatibility facade for CRM shared boundaries.
 * Canonical implementations live in ./lib/* — import from focused modules
 * for new code; this file preserves stable public export paths.
 *
 * Facade line budget: keep under 200 lines (exception recorded in libBoundaries.test.ts).
 */
// biome-ignore lint/performance/noBarrelFile: intentional compatibility facade for stable Convex export paths
export { createActivity } from "./lib/activity";
export {
  assertBulkDeleteLimit,
  assertBulkDeleteMutationBatch,
  BULK_DELETE_MUTATION_BATCH_SIZE,
  requestedProposalQueryIds,
} from "./lib/bulkOps";
export { creatorInitials, deleteStorageFile, nextCode } from "./lib/codes";
export {
  canActAsLeaveHeadReviewer,
  canHeadReview,
  getHeadReviewerRolesForStaff,
  getLeaveApprovalActions,
  isHrReviewer,
} from "./lib/leavePolicy";
export {
  canReceiveNotification,
  deleteEntityNotifications,
  expandNotificationEmailRoles,
  flushDeferredNotificationCleanup,
  NOTIFICATION_EMAIL_STAGGER_MS,
  type NotificationEntityIdentity,
  notifyRoles,
  notifyStaffMatching,
  notifyStaffMember,
} from "./lib/notifications";
export {
  deleteJobCardCascade,
  publicJobCard,
  publicQuery,
  publicTravelBatch,
} from "./lib/presentation";
export {
  applyCementPortalScope,
  assertCementQueryTypeAllowed,
  canEditContractingRecord,
  canEditOperationsRecord,
  canEditProposalRecord,
  canSeeAllCementRecords,
  canSeeAllPortalRecords,
  canSeeDepartmentRecords,
  canSeeJobCardRecord,
  canSeeProposalRecord,
  canSeeQueryRecord,
  contractingNotifyRolesForQueryType,
  editorPatch,
  hasCementRole,
  isCementQueryType,
  isCollaborator,
  ownsAuthRecord,
  ownsNamedRecord,
  ownsStaffRecord,
  shouldApplyCementScope,
} from "./lib/recordScope";
export {
  ALL_ROLES,
  CEMENT_QUERY_TYPES,
  CEMENT_ROLES,
  CONTRACTING_TEAM_ROLES,
  DIRECTOR_PERMISSIONS,
  getRolePermissions,
  HEAD_ROLES,
  PAYMENT_TERMS,
  PERMISSIONS,
  paymentTermsFor,
  ROLE_PERMISSIONS,
  SALES_REP_ROLES,
  TEAM_PICKER_PERMISSIONS,
  TICKETING_TEAM_ROLES,
} from "./lib/rolePolicy";
export {
  getPortalAccess,
  hasRole,
  isAdmin,
  isAdminDirectorOrRole,
  isDefined,
  isDirectorOrAdmin,
  isHead,
  normalizeEmail,
  type PortalAccess,
  requireAnyPermission,
  requireHeadOrAdmin,
  requireStaff,
} from "./lib/staffAccess";
export {
  assertDateRangeOrder,
  assertMaxWordCount,
  countWords,
  endOfPortalDateOnly,
  filterRecordsByDateRange,
  MAX_QUERY_NOTES_WORDS,
  type PortalDateRange,
  parsePortalDateOnly,
  portalDateRangeValidator,
  resolvePortalDateRange,
} from "./lib/validators";
