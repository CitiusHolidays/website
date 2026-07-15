import { paginationResultValidator } from "convex/server";
import { v } from "convex/values";

// These presentation fields intentionally remain strings because empty means
// "not assigned" and legacy staff rows may still carry string identifiers.
const staffIdOrEmptyValidator = v.string();

export const portalAccessResultValidator = v.object({
  allowed: v.boolean(),
  authUserId: v.optional(v.string()),
  bootstrap: v.optional(v.boolean()),
  email: v.string(),
  name: v.string(),
  permissions: v.array(v.string()),
  reason: v.optional(v.union(v.literal("UNAUTHENTICATED"), v.literal("NOT_STAFF"))),
  roles: v.array(v.string()),
  staffId: v.optional(v.id("staffUsers")),
});

const staffOutputValidator = v.object({
  active: v.boolean(),
  authLinked: v.boolean(),
  confirmationDate: v.string(),
  createdAt: v.string(),
  department: v.string(),
  email: v.string(),
  emailAlertRoles: v.array(v.string()),
  employmentStatus: v.union(v.literal("Probationer"), v.literal("Confirmed")),
  function: v.string(),
  id: v.id("staffUsers"),
  joiningDate: v.string(),
  leaveEscalationApproverName: v.string(),
  leaveEscalationApproverStaffId: staffIdOrEmptyValidator,
  leaveFinalAuthorityName: v.string(),
  leaveFinalAuthorityStaffId: staffIdOrEmptyValidator,
  leaveHeadApproverId: staffIdOrEmptyValidator,
  leaveHeadApproverName: v.string(),
  leaveHrCopyName: v.string(),
  leaveHrCopyStaffId: staffIdOrEmptyValidator,
  leaveLevel1ApproverName: v.string(),
  leaveLevel1ApproverStaffId: staffIdOrEmptyValidator,
  leavePolicyGroup: v.string(),
  location: v.string(),
  marriageLeaveUsed: v.boolean(),
  maternityEventsUsed: v.number(),
  mobile: v.string(),
  name: v.string(),
  onboardingStatus: v.union(v.literal("pending"), v.literal("ready"), v.literal("not_started")),
  paternityEventsUsed: v.number(),
  pendingOnboarding: v.boolean(),
  reportingManagerName: v.string(),
  reportingManagerStaffId: staffIdOrEmptyValidator,
  roles: v.array(v.string()),
  updatedAt: v.string(),
});
export const staffListResultValidator = v.array(staffOutputValidator);
export const staffListPageResultValidator = paginationResultValidator(staffOutputValidator);

const staffDirectoryOutputValidator = v.object({
  confirmationDate: v.string(),
  department: v.string(),
  email: v.string(),
  employmentStatus: v.union(v.literal("Probationer"), v.literal("Confirmed")),
  function: v.string(),
  id: v.id("staffUsers"),
  isCurrentUser: v.boolean(),
  joiningDate: v.string(),
  leaveEscalationApproverName: v.string(),
  leaveEscalationApproverStaffId: staffIdOrEmptyValidator,
  leaveFinalAuthorityName: v.string(),
  leaveFinalAuthorityStaffId: staffIdOrEmptyValidator,
  leaveHrCopyName: v.string(),
  leaveHrCopyStaffId: staffIdOrEmptyValidator,
  leaveLevel1ApproverName: v.string(),
  leaveLevel1ApproverStaffId: staffIdOrEmptyValidator,
  leavePolicyGroup: v.string(),
  location: v.string(),
  mobile: v.string(),
  name: v.string(),
  reportingManagerName: v.string(),
  reportingManagerStaffId: staffIdOrEmptyValidator,
  roles: v.array(v.string()),
});
export const staffDirectoryResultValidator = v.array(staffDirectoryOutputValidator);
export const staffDirectoryListPageResultValidator = paginationResultValidator(
  staffDirectoryOutputValidator
);

export const accountsStaffListResultValidator = v.array(
  v.object({
    email: v.string(),
    id: v.id("staffUsers"),
    jobCardCreatorEnabled: v.boolean(),
    name: v.string(),
    roles: v.array(v.string()),
  })
);
export const staffIdResultValidator = v.object({ id: v.id("staffUsers") });
export const staffUpsertResultValidator = v.object({
  created: v.boolean(),
  id: v.id("staffUsers"),
});

export const dropdownsResultValidator = v.record(v.string(), v.array(v.string()));
export const clearPresetsResultValidator = v.object({
  deleted: v.object({
    dropdownOptions: v.number(),
    paymentTerms: v.number(),
    roleDefinitions: v.number(),
  }),
});
export const nullableDropdownIdResultValidator = v.union(
  v.null(),
  v.object({ id: v.id("dropdownOptions") })
);

export const leaveApproverSyncResultValidator = v.object({
  skipped: v.number(),
  updated: v.number(),
});
export const leaveApproverCandidateListResultValidator = v.array(
  v.object({
    email: v.string(),
    id: v.id("staffUsers"),
    label: v.string(),
    name: v.string(),
    roles: v.array(v.string()),
  })
);

export const staffOnboardingResultValidator = v.object({
  message: v.string(),
  step: v.union(v.literal("verification_sent"), v.literal("password_setup_sent")),
});
export const successResultValidator = v.object({ success: v.literal(true) });

const staffImportResultRowValidator = v.object({
  action: v.union(
    v.literal("created"),
    v.literal("updated"),
    v.literal("skipped"),
    v.literal("error")
  ),
  email: v.string(),
  message: v.optional(v.string()),
  name: v.string(),
  roles: v.array(v.string()),
});
const staffImportSummaryValidator = v.object({
  created: v.number(),
  errors: v.number(),
  skipped: v.number(),
  updated: v.number(),
});
export const staffImportResultValidator = v.object({
  results: v.array(staffImportResultRowValidator),
  summary: staffImportSummaryValidator,
});

const workbookValueValidator = v.union(v.string(), v.number(), v.boolean(), v.array(v.string()));
const workbookPreviewRowValidator = v.object({
  action: v.union(
    v.literal("created"),
    v.literal("updated"),
    v.literal("unchanged"),
    v.literal("skipped")
  ),
  after: v.record(v.string(), workbookValueValidator),
  before: v.record(v.string(), workbookValueValidator),
  changes: v.array(
    v.object({
      after: workbookValueValidator,
      before: workbookValueValidator,
      field: v.string(),
    })
  ),
  email: v.string(),
  emailNormalized: v.string(),
  message: v.optional(v.string()),
  name: v.string(),
  sourceRowNumber: v.optional(v.number()),
  sourceSheet: v.optional(v.string()),
  staffId: v.optional(v.id("staffUsers")),
});
const workbookSummaryValidator = v.object({
  created: v.number(),
  skipped: v.number(),
  unchanged: v.number(),
  updated: v.number(),
});
export const staffWorkbookResultValidator = v.object({
  rows: v.array(workbookPreviewRowValidator),
  summary: workbookSummaryValidator,
});

export const leaveLapseResultValidator = v.object({
  fiscalYear: v.string(),
  lapsedRows: v.number(),
});
