import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  importFailureValidator,
  importRoomSummaryValidator,
  travelBatchSummaryTransitionValidator,
} from "./lib/importContractValidators";
import { roomTypeValidator } from "./lib/roomTypeValidators";

const bookingStatus = v.union(
  v.literal("pending"),
  v.literal("confirmed"),
  v.literal("failed"),
  v.literal("cancelled"),
  v.literal("refunded")
);

const staffRole = v.union(
  v.literal("Admin"),
  v.literal("Directors"),
  v.literal("Sales"),
  v.literal("Sales Head"),
  v.literal("Contracting"),
  v.literal("Contracting Head"),
  v.literal("Accounts"),
  v.literal("Accounts Head"),
  v.literal("Operations"),
  v.literal("Operations Head"),
  v.literal("Ticketing"),
  v.literal("Head of Ticketing"),
  v.literal("Tour Manager"),
  v.literal("Finance"),
  v.literal("HR"),
  v.literal("Contracting Cement"),
  v.literal("Operations Cement"),
  v.literal("Sales Cement"),
  v.literal("Director Cement")
);

const queryType = v.union(
  v.literal("MICE"),
  v.literal("MICE Bidding"),
  v.literal("Cement"),
  v.literal("Cement Bidding"),
  v.literal("FIT"),
  v.literal("Family Group"),
  v.literal("B2B"),
  v.literal("Spiritual")
);

const travelType = v.union(v.literal("Domestic Travel"), v.literal("International Travel"));

const ticketingScope = v.union(
  v.literal("Domestic"),
  v.literal("International"),
  v.literal("Both"),
  v.literal("Not required")
);

const salesStatus = v.union(
  v.literal("Proposal in discussion"),
  v.literal("Change in destination"),
  v.literal("Date/Destination Change Required"),
  v.literal("Order Confirmed"),
  v.literal("Order Lost")
);

const leadStage = v.union(
  v.literal("Inquiry"),
  v.literal("Proposal"),
  v.literal("Negotiation"),
  v.literal("Confirmation"),
  v.literal("Lost"),
  v.literal("Closed")
);

const querySource = v.union(
  v.literal("Website"),
  v.literal("WhatsApp"),
  v.literal("Email"),
  v.literal("Client"),
  v.literal("Referral"),
  v.literal("Citius Concierge"),
  v.literal("Sacred Bharat")
);

const contractingStatus = v.union(
  v.literal("Query Received"),
  v.literal("Proposal in progress"),
  v.literal("Proposal sent"),
  v.literal("Change in destination"),
  v.literal("Date/Destination Change Required"),
  v.literal("Order Confirmed"),
  v.literal("Order Lost")
);

const lostReason = v.union(
  v.literal("Price"),
  v.literal("Competition"),
  v.literal("Not travelling"),
  v.literal("Other")
);

const visaStatus = v.union(
  v.literal("Not Required"),
  v.literal("Not Started"),
  v.literal("Checklist Shared"),
  v.literal("Documents Pending"),
  v.literal("Documents Verified"),
  v.literal("Appointment Scheduled"),
  v.literal("Submitted"),
  v.literal("Awaiting"),
  v.literal("Approved"),
  v.literal("Rejected"),
  v.literal("Re-applied")
);

const ticketStatus = v.union(
  v.literal("Pending Issue"),
  v.literal("Issued"),
  v.literal("Name Change Required"),
  v.literal("Reissue Required"),
  v.literal("Cancelled"),
  v.literal("Refund Pending"),
  v.literal("Refunded")
);

const paymentType = v.union(
  v.literal("Company Paid"),
  v.literal("Self Paid"),
  v.literal("Upgraded Self Paid")
);

// Storage is canonical after the snapshot-seeded room-type-v2 rehearsal
// independently verified zero legacy values. Import edges continue to accept
// reviewed spreadsheet aliases and canonicalize them before storage.
const roomType = roomTypeValidator;

const foodPreference = v.union(
  v.literal("Veg"),
  v.literal("Non-Veg"),
  v.literal("Jain"),
  v.literal("Vegan")
);

const callingStatus = v.union(v.literal("Pending"), v.literal("Done"), v.literal("No response"));

const guestType = v.union(v.literal("Employee"), v.literal("Client"), v.literal("VIP"));

const expenseCurrency = v.union(
  v.literal("INR"),
  v.literal("USD"),
  v.literal("AED"),
  v.literal("EUR"),
  v.literal("THB"),
  v.literal("SGD")
);

const approvalStatus = v.union(
  v.literal("Pending"),
  v.literal("Approved"),
  v.literal("Rejected"),
  v.literal("Needs Info")
);

const leaveType = v.union(
  v.literal("Privilege"),
  v.literal("Casual"),
  v.literal("Sick"),
  v.literal("Maternity"),
  v.literal("Paternity"),
  v.literal("Bereavement"),
  v.literal("Marriage"),
  v.literal("Leave Without Pay")
);

const reviewStatus = v.union(v.literal("Pending"), v.literal("Approved"), v.literal("Rejected"));

const productionTestRecipeIdValidator = v.union(
  v.literal("inbound_leads"),
  v.literal("auth_email"),
  v.literal("crm_notifications"),
  v.literal("concierge"),
  v.literal("journey_planner"),
  v.literal("razorpay_new_order"),
  v.literal("document_preview"),
  v.literal("sacred_bharat_publication"),
  v.literal("scheduled_job:check_cl_sl_leave_lapse"),
  v.literal("scheduled_job:cleanup_ai_runtime"),
  v.literal("scheduled_job:cleanup_passenger_exports"),
  v.literal("scheduled_job:cleanup_portal_rate_limits"),
  v.literal("scheduled_job:cleanup_sacred_bharat_rate_limits"),
  v.literal("scheduled_job:purge_commercial_files"),
  v.literal("scheduled_job:reconcile_crm_metrics"),
  v.literal("scheduled_job:reconcile_list_search"),
  v.literal("scheduled_job:reconcile_proposal_links"),
  v.literal("scheduled_job:reconcile_proposal_relations"),
  v.literal("scheduled_job:reconcile_query_commercial"),
  v.literal("scheduled_job:run_workflow_nudges")
);

// biome-ignore assist/source/useSortedKeys: tables stay grouped by product domain and migration history
export default defineSchema({
  // Transactional auth-email receipts intentionally exclude recipient, token,
  // URL, subject, and body data. The digest is a one-way correlation identity.
  authEmailDeliveries: defineTable({
    attempts: v.number(),
    correlationDigest: v.string(),
    createdAt: v.number(),
    expiresAt: v.number(),
    failureCode: v.optional(v.string()),
    providerStatus: v.optional(v.number()),
    purpose: v.union(v.literal("password_reset"), v.literal("verification")),
    sentAt: v.optional(v.number()),
    status: v.union(
      v.literal("queued"),
      v.literal("sending"),
      v.literal("retrying"),
      v.literal("sent"),
      v.literal("skipped"),
      v.literal("exhausted")
    ),
    updatedAt: v.number(),
  })
    .index("by_correlationDigest", ["correlationDigest"])
    .index("by_updatedAt", ["updatedAt"]),

  // A one-way, recipient-bound intent lets trusted staff onboarding select its
  // independent control without trusting callback URL parameters.
  authEmailDeliveryIntents: defineTable({
    controlKey: v.literal("email.auth.staff_setup"),
    correlationDigest: v.string(),
    createdAt: v.number(),
    expiresAt: v.number(),
    purpose: v.union(v.literal("password_reset"), v.literal("verification")),
    recipientDigest: v.string(),
  }).index("by_correlationDigest", ["correlationDigest"]),

  authIdentityLinks: defineTable({
    canonicalAuthUserId: v.string(),
    createdAt: v.number(),
    legacyAuthUserId: v.string(),
    status: v.union(v.literal("linked"), v.literal("quarantined")),
    updatedAt: v.number(),
  })
    .index("by_legacyAuthUserId", ["legacyAuthUserId"])
    .index("by_canonicalAuthUserId", ["canonicalAuthUserId"]),

  authIdentityQuarantines: defineTable({
    createdAt: v.number(),
    legacyAuthUserIdHash: v.string(),
    reason: v.union(v.literal("conflicting_canonical_link"), v.literal("ambiguous_owner")),
    resolvedAt: v.optional(v.number()),
    table: v.string(),
  })
    .index("by_reason_createdAt", ["reason", "createdAt"])
    .index("by_hash_table", ["legacyAuthUserIdHash", "table"])
    .index("by_table_createdAt", ["table", "createdAt"]),

  activityLogs: defineTable({
    action: v.string(),
    actorId: v.string(),
    actorName: v.string(),
    createdAt: v.number(),
    entityId: v.optional(v.string()),
    entityType: v.string(),
    message: v.string(),
    metadata: v.optional(v.any()),
  })
    .index("by_entity", ["entityType", "entityId"])
    .index("by_createdAt", ["createdAt"]),

  additionalServices: defineTable({
    amount: v.number(),
    approved: v.boolean(),
    createdAt: v.number(),
    createdBy: v.string(),
    description: v.string(),
    jobCardId: v.id("jobCards"),
    notes: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_jobCardId", ["jobCardId"])
    .index("by_createdAt", ["createdAt"]),

  aiRateLimits: defineTable({
    count: v.number(),
    expiresAt: v.number(),
    feature: v.union(v.literal("concierge"), v.literal("journeyPlanner")),
    keyHash: v.string(),
    resetAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_feature_key", ["feature", "keyHash"])
    .index("by_expiresAt", ["expiresAt"]),

  aiTelemetry: defineTable({
    createdAt: v.number(),
    fallback: v.boolean(),
    feature: v.union(v.literal("concierge"), v.literal("journeyPlanner")),
    finishReason: v.optional(v.string()),
    inputTokens: v.optional(v.number()),
    latencyMs: v.number(),
    model: v.string(),
    outputTokens: v.optional(v.number()),
    retentionUntil: v.number(),
    terminalState: v.union(v.literal("completed"), v.literal("failed"), v.literal("interrupted")),
  }).index("by_retentionUntil", ["retentionUntil"]),

  approvalRequests: defineTable({
    amount: v.optional(v.number()),
    createdAt: v.number(),
    decidedAt: v.optional(v.number()),
    decidedBy: v.optional(v.string()),
    decidedByName: v.optional(v.string()),
    decisionNote: v.optional(v.string()),
    entityId: v.string(),
    entityType: v.string(),
    expenseVersion: v.optional(v.number()),
    proofDigest: v.optional(v.string()),
    requestCode: v.string(),
    requestedBy: v.string(),
    requestedByName: v.optional(v.string()),
    status: approvalStatus,
    summary: v.string(),
    type: v.string(),
    updatedAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_entity", ["entityType", "entityId"])
    .index("by_type_status", ["type", "status"])
    .index("by_createdAt", ["createdAt"]),

  attachments: defineTable({
    contentDigest: v.optional(v.string()),
    createdAt: v.number(),
    createdBy: v.string(),
    entityId: v.string(),
    entityType: v.string(),
    fileName: v.string(),
    mimeType: v.optional(v.string()),
    storageId: v.optional(v.string()),
    url: v.optional(v.string()),
  })
    .index("by_entity", ["entityType", "entityId"])
    .index("by_storageId", ["storageId"]),

  bookingPaymentEvents: defineTable({
    bookingId: v.id("bookings"),
    createdAt: v.number(),
    outcome: v.string(),
    paymentId: v.optional(v.string()),
    providerEventId: v.string(),
    reason: v.string(),
    statusAfter: bookingStatus,
    statusBefore: bookingStatus,
    transition: v.union(
      v.literal("authorized"),
      v.literal("confirmed"),
      v.literal("failed"),
      v.literal("refunded")
    ),
  })
    .index("by_providerEventId", ["providerEventId"])
    .index("by_bookingId_createdAt", ["bookingId", "createdAt"]),

  bookings: defineTable({
    confirmedAt: v.optional(v.number()),
    createdAt: v.number(),
    currency: v.string(),
    inventoryDebitedAt: v.optional(v.number()),
    inventoryDebitedEventId: v.optional(v.string()),
    legacyBookingId: v.optional(v.string()),
    notes: v.optional(v.string()),
    razorpayOrderId: v.string(),
    razorpayPaymentId: v.string(),
    razorpaySignature: v.optional(v.string()),
    status: bookingStatus,
    totalAmount: v.number(),
    travelerDetails: v.optional(v.any()),
    travelers: v.number(),
    tripId: v.id("trips"),
    updatedAt: v.number(),
    userId: v.string(),
  })
    .index("by_userId_createdAt", ["userId", "createdAt"])
    .index("by_razorpayOrderId", ["razorpayOrderId"])
    .index("by_razorpayPaymentId", ["razorpayPaymentId"])
    .index("by_legacyBookingId", ["legacyBookingId"])
    .index("by_status_createdAt", ["status", "createdAt"])
    .index("by_tripId", ["tripId"]),

  customerJourneyEntitlements: defineTable({
    accountHolderProfileId: v.optional(v.id("userProfiles")),
    authUserId: v.string(),
    bookingId: v.optional(v.id("bookings")),
    capabilities: v.array(v.union(v.literal("view_booking"), v.literal("view_confirmed_trip"))),
    confirmedOfferId: v.optional(v.id("confirmedOffers")),
    createdAt: v.number(),
    grantedByStaffId: v.optional(v.id("staffUsers")),
    queryId: v.optional(v.id("queries")),
    revokedAt: v.optional(v.number()),
    role: v.union(v.literal("purchaser"), v.literal("organizer"), v.literal("traveller")),
    source: v.union(
      v.literal("public_booking_owner"),
      v.literal("crm_operator_grant"),
      v.literal("identity_migration")
    ),
    updatedAt: v.number(),
  })
    .index("by_authUserId_createdAt", ["authUserId", "createdAt"])
    .index("by_bookingId_authUserId", ["bookingId", "authUserId"])
    .index("by_confirmedOfferId_authUserId", ["confirmedOfferId", "authUserId"])
    .index("by_queryId_authUserId", ["queryId", "authUserId"]),

  checklistTasks: defineTable({
    category: v.string(),
    completed: v.boolean(),
    completedAt: v.optional(v.number()),
    createdAt: v.number(),
    createdBy: v.string(),
    dueDate: v.optional(v.string()),
    jobCardId: v.id("jobCards"),
    ownerRole: v.optional(staffRole),
    title: v.string(),
    updatedAt: v.number(),
  })
    .index("by_jobCardId", ["jobCardId"])
    .index("by_completed", ["completed"]),

  clients: defineTable({
    contactPerson: v.optional(v.string()),
    corporateDetails: v.optional(v.string()),
    createdAt: v.number(),
    email: v.optional(v.string()),
    emailNormalized: v.optional(v.string()),
    name: v.string(),
    phone: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_name", ["name"])
    .index("by_emailNormalized", { fields: ["emailNormalized"] }),

  commercialFiles: defineTable({
    category: v.union(v.literal("workingFile"), v.literal("proposalDoc")),
    createdAt: v.number(),
    createdBy: v.string(),
    deletedAt: v.optional(v.number()),
    deletedBy: v.optional(v.string()),
    fileName: v.string(),
    fileSize: v.number(),
    historySourceId: v.optional(v.string()),
    jobCardId: v.optional(v.id("jobCards")),
    lifecycle: v.union(v.literal("active"), v.literal("history"), v.literal("deleted")),
    mimeType: v.string(),
    note: v.optional(v.string()),
    priorLifecycle: v.optional(v.union(v.literal("active"), v.literal("history"))),
    proposalId: v.optional(v.id("proposals")),
    purgeAfter: v.optional(v.number()),
    queryId: v.optional(v.id("queries")),
    restoredAt: v.optional(v.number()),
    sourceCode: v.string(),
    sourceId: v.string(),
    sourceLabel: v.string(),
    sourceType: v.union(v.literal("query"), v.literal("proposal"), v.literal("jobCard")),
    storageId: v.id("_storage"),
    teamArea: v.union(
      v.literal("sales"),
      v.literal("contracting"),
      v.literal("ticketing"),
      v.literal("accounts"),
      v.literal("operations"),
      v.literal("tourManager")
    ),
    updatedAt: v.number(),
    uploaderTeam: v.string(),
  })
    .index("by_source", ["sourceType", "sourceId"])
    .index("by_proposal_lifecycle", ["proposalId", "lifecycle"])
    .index("by_purgeAfter", ["purgeAfter"])
    .index("by_storageId", ["storageId"])
    .index("by_createdAt", ["createdAt"]),

  commercialFileUploadSessions: defineTable({
    authUserId: v.string(),
    category: v.union(v.literal("workingFile"), v.literal("proposalDoc")),
    createdAt: v.number(),
    expiresAt: v.number(),
    sourceId: v.string(),
    sourceType: v.union(v.literal("query"), v.literal("proposal"), v.literal("jobCard")),
    storageId: v.optional(v.id("_storage")),
    teamArea: v.union(
      v.literal("sales"),
      v.literal("contracting"),
      v.literal("ticketing"),
      v.literal("accounts"),
      v.literal("operations"),
      v.literal("tourManager")
    ),
    token: v.string(),
    usedAt: v.optional(v.number()),
  })
    .index("by_token", ["token"])
    .index("by_authUserId_createdAt", ["authUserId", "createdAt"])
    .index("by_storageId", ["storageId"])
    .index("by_expiresAt", ["expiresAt"]),

  // Passport uploads remain quarantined until a server-owned ticket has been
  // claimed, the stored bytes have passed content validation, and the
  // encrypted replacement plus ticket state are committed together. Raw
  // ticket tokens are never persisted.
  passportUploadTickets: defineTable({
    actorId: v.string(),
    claimExpiresAt: v.optional(v.number()),
    claimedAt: v.optional(v.number()),
    claimedStorageId: v.optional(v.id("_storage")),
    cleanupAfter: v.optional(v.number()),
    cleanupAttempts: v.number(),
    cleanupCompletedAt: v.optional(v.number()),
    cleanupOwner: v.optional(v.string()),
    contentDigest: v.optional(v.string()),
    createdAt: v.number(),
    expiresAt: v.number(),
    failureCode: v.optional(
      v.union(
        v.literal("active_content"),
        v.literal("cleanup_failed"),
        v.literal("encryption_failed"),
        v.literal("invalid_size"),
        v.literal("mime_mismatch"),
        v.literal("password_protected"),
        v.literal("processing_interrupted"),
        v.literal("storage_missing"),
        v.literal("storage_referenced"),
        v.literal("unsupported_signature")
      )
    ),
    mimeType: v.optional(v.string()),
    promotedAt: v.optional(v.number()),
    promotedStorageId: v.optional(v.id("_storage")),
    purpose: v.literal("passport_scan"),
    status: v.union(
      v.literal("issued"),
      v.literal("claimed"),
      v.literal("promoted"),
      v.literal("rejected"),
      v.literal("cleanup_pending")
    ),
    targetJobCardId: v.id("jobCards"),
    targetTravellerId: v.id("travellers"),
    tokenDigest: v.string(),
    updatedAt: v.number(),
    validatedAt: v.optional(v.number()),
  })
    .index("by_tokenDigest", ["tokenDigest"])
    .index("by_claimedStorageId", ["claimedStorageId"])
    .index("by_expiresAt", ["expiresAt"])
    .index("by_status_cleanupAfter", ["status", "cleanupAfter"]),

  commercialFilePurgeRuns: defineTable({
    completedAt: v.optional(v.number()),
    continuation: v.number(),
    createdAt: v.number(),
    cursor: v.optional(v.string()),
    cutoffAt: v.number(),
    failedFiles: v.number(),
    failedSessions: v.number(),
    failureCode: v.optional(v.string()),
    generation: v.number(),
    key: v.literal("commercialFiles"),
    leaseExpiresAt: v.number(),
    processedFiles: v.number(),
    processedSessions: v.number(),
    purgedFiles: v.number(),
    purgedSessions: v.number(),
    stage: v.union(v.literal("upload_sessions"), v.literal("deleted_files")),
    startedAt: v.optional(v.number()),
    status: v.union(
      v.literal("queued"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("completed_with_failures"),
      v.literal("failed")
    ),
    updatedAt: v.number(),
  })
    .index("by_key_updatedAt", ["key", "updatedAt"])
    .index("by_status_updatedAt", ["status", "updatedAt"]),

  commercialFilePurgeState: defineTable({
    activeRunId: v.optional(v.id("commercialFilePurgeRuns")),
    generation: v.number(),
    key: v.literal("commercialFiles"),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),

  // Document Preview records contain only operation metadata and private
  // storage references. Source authorization is re-evaluated before every
  // status or byte response; an artifact never grants access on its own.
  documentPreviewOperations: defineTable({
    artifactMimeType: v.optional(v.string()),
    artifactStorageId: v.optional(v.id("_storage")),
    attemptCount: v.number(),
    createdAt: v.number(),
    durationMs: v.optional(v.number()),
    errorCode: v.optional(
      v.union(
        v.literal("conversion_failed"),
        v.literal("corrupt"),
        v.literal("encrypted"),
        v.literal("expansion_limit"),
        v.literal("processing_timeout"),
        v.literal("resource_limit"),
        v.literal("signature_mismatch"),
        v.literal("unsafe_content"),
        v.literal("unsupported_format"),
        v.literal("worker_unavailable")
      )
    ),
    generation: v.number(),
    leaseExpiresAt: v.optional(v.number()),
    leaseId: v.optional(v.string()),
    pageCount: v.optional(v.number()),
    previewKind: v.union(v.literal("presentation"), v.literal("spreadsheet"), v.literal("word")),
    sheetCount: v.optional(v.number()),
    sourceId: v.string(),
    sourceMimeType: v.string(),
    sourceSize: v.number(),
    sourceStorageId: v.id("_storage"),
    sourceType: v.union(
      v.literal("commercialFile"),
      v.literal("expenseAttachment"),
      v.literal("passport"),
      v.literal("proposalAttachment"),
      v.literal("proposalDocument"),
      v.literal("queryAttachment")
    ),
    status: v.union(v.literal("preparing"), v.literal("ready"), v.literal("unavailable")),
    updatedAt: v.number(),
    warningCodes: v.array(v.string()),
  })
    .index("by_sourceType_and_sourceId", ["sourceType", "sourceId"])
    .index("by_status_and_updatedAt", ["status", "updatedAt"])
    .index("by_sourceStorageId", ["sourceStorageId"])
    .index("by_artifactStorageId", ["artifactStorageId"]),

  // Conversion telemetry is deliberately source-free: no filename, record
  // id, actor, extracted text, formula, cell value, or storage reference.
  documentPreviewMetrics: defineTable({
    createdAt: v.number(),
    durationMs: v.number(),
    errorCode: v.optional(
      v.union(
        v.literal("conversion_failed"),
        v.literal("corrupt"),
        v.literal("encrypted"),
        v.literal("expansion_limit"),
        v.literal("processing_timeout"),
        v.literal("resource_limit"),
        v.literal("signature_mismatch"),
        v.literal("unsafe_content"),
        v.literal("unsupported_format"),
        v.literal("worker_unavailable")
      )
    ),
    format: v.union(v.literal("presentation"), v.literal("spreadsheet"), v.literal("word")),
    outcome: v.union(v.literal("ready"), v.literal("unavailable")),
    pageCount: v.optional(v.number()),
    sheetCount: v.optional(v.number()),
    sizeBand: v.union(
      v.literal("under_1mb"),
      v.literal("1mb_to_5mb"),
      v.literal("5mb_to_10mb"),
      v.literal("10mb_to_15mb"),
      v.literal("over_15mb")
    ),
  }).index("by_createdAt", ["createdAt"]),

  documentPreviewWarmRuns: defineTable({
    completedAt: v.optional(v.number()),
    continuation: v.number(),
    createdAt: v.number(),
    cursor: v.union(v.string(), v.null()),
    failureCode: v.optional(v.string()),
    generation: v.number(),
    key: v.literal("activeCommercialDocuments"),
    prepared: v.number(),
    processed: v.number(),
    stage: v.union(v.literal("commercialFiles"), v.literal("proposals"), v.literal("complete")),
    status: v.union(v.literal("running"), v.literal("completed"), v.literal("failed")),
    updatedAt: v.number(),
  })
    .index("by_key", ["key"])
    .index("by_status_and_updatedAt", ["status", "updatedAt"]),

  // Short-lived bearer tickets bridge authorized actions to private HTTP
  // streaming without serializing file bytes or exposing storage identifiers.
  documentPreviewDeliveries: defineTable({
    actorId: v.optional(v.string()),
    claimedAt: v.optional(v.number()),
    createdAt: v.number(),
    deliveryStorageId: v.id("_storage"),
    encrypted: v.boolean(),
    expectedSourceStorageId: v.id("_storage"),
    expiresAt: v.number(),
    generation: v.number(),
    kind: v.union(v.literal("portal"), v.literal("worker")),
    leaseId: v.optional(v.string()),
    operationId: v.optional(v.id("documentPreviewOperations")),
    previewKind: v.union(
      v.literal("image"),
      v.literal("pdf"),
      v.literal("presentation"),
      v.literal("spreadsheet"),
      v.literal("text"),
      v.literal("unsupported"),
      v.literal("word")
    ),
    servingArtifact: v.boolean(),
    sourceId: v.string(),
    sourceType: v.union(
      v.literal("commercialFile"),
      v.literal("expenseAttachment"),
      v.literal("passport"),
      v.literal("proposalAttachment"),
      v.literal("proposalDocument"),
      v.literal("queryAttachment")
    ),
    tokenHash: v.string(),
    warningCodes: v.array(v.string()),
  })
    .index("by_tokenHash", ["tokenHash"])
    .index("by_expiresAt", ["expiresAt"]),

  confirmedOffers: defineTable({
    airfarePerPax: v.number(),
    approxMargin: v.optional(v.number()),
    // Optional only for the widening window. New offers always bind one
    // confirmation clock to an immutable Proposal-Query revision handoff.
    confirmedAt: v.optional(v.number()),
    confirmedPax: v.number(),
    createdAt: v.number(),
    createdBy: v.string(),
    destination: v.optional(v.string()),
    landCostPerPax: v.number(),
    profitPerPax: v.number(),
    proposalId: v.id("proposals"),
    proposalQueryHandoffId: v.optional(v.id("proposalQueryHandoffs")),
    proposalRevision: v.optional(v.number()),
    queryId: v.id("queries"),
    sellingPricePerPax: v.number(),
    source: v.optional(querySource),
    sourceConsentAt: v.optional(v.number()),
    sourceInboundIntentId: v.optional(v.id("inboundQueryIntents")),
    taxRate: v.optional(v.number()),
    travelEndDate: v.optional(v.string()),
    travelStartDate: v.string(),
    updatedAt: v.number(),
    visaCostPerPax: v.number(),
  })
    .index("by_queryId", ["queryId"])
    .index("by_proposalId", ["proposalId"]),

  contractingAssignments: defineTable({
    createdAt: v.number(),
    createdBy: v.string(),
    notes: v.optional(v.string()),
    ownerId: v.optional(v.string()),
    ownerName: v.string(),
    queryId: v.id("queries"),
    status: contractingStatus,
    updatedAt: v.number(),
  })
    .index("by_queryId", ["queryId"])
    .index("by_ownerId", ["ownerId"]),

  crmHandoffEvents: defineTable({
    convertedQueryId: v.optional(v.string()),
    createdAt: v.number(),
    inboundIntentId: v.optional(v.id("inboundQueryIntents")),
    isSynthetic: v.optional(v.boolean()),
    source: v.union(
      v.literal("Citius Concierge"),
      v.literal("Sacred Bharat"),
      v.literal("Website")
    ),
  })
    .index("by_createdAt", ["createdAt"])
    .index("by_inboundIntentId_createdAt", {
      fields: ["inboundIntentId", "createdAt"],
    }),

  crmImportBatches: defineTable({
    accepted: v.number(),
    attemptCount: v.number(),
    batchId: v.string(),
    completedAt: v.optional(v.number()),
    created: v.number(),
    createdAt: v.number(),
    errors: v.array(importFailureValidator),
    failed: v.number(),
    jobCardId: v.id("jobCards"),
    processed: v.number(),
    remaining: v.number(),
    roomSummary: importRoomSummaryValidator,
    status: v.union(v.literal("processing"), v.literal("completed"), v.literal("retryable")),
    updated: v.number(),
    updatedAt: v.number(),
  })
    .index("by_batchId", ["batchId"])
    .index("by_jobCardId", ["jobCardId"]),

  passengerImportOperations: defineTable({
    batchTotal: v.number(),
    completedAt: v.optional(v.number()),
    completedBatches: v.number(),
    created: v.number(),
    errorSummary: v.object({ retryable: v.number(), terminal: v.number() }),
    failed: v.number(),
    importKinds: v.array(v.string()),
    initiatedBy: v.string(),
    initiatedByStaffId: v.optional(v.id("staffUsers")),
    jobCardId: v.id("jobCards"),
    processed: v.number(),
    remaining: v.number(),
    roomSummary: importRoomSummaryValidator,
    sourceDigest: v.string(),
    startedAt: v.number(),
    status: v.union(v.literal("running"), v.literal("completed"), v.literal("partial")),
    terminalBatches: v.optional(v.number()),
    total: v.number(),
    updated: v.number(),
    updatedAt: v.number(),
  })
    .index("by_initiatedBy_updatedAt", ["initiatedBy", "updatedAt"])
    .index("by_initiatedBy_jobCardId_sourceDigest", ["initiatedBy", "jobCardId", "sourceDigest"]),

  passengerImportOperationBatches: defineTable({
    accepted: v.number(),
    batchId: v.string(),
    batchIndex: v.optional(v.number()),
    created: v.number(),
    createdAt: v.number(),
    errorSummary: v.object({ retryable: v.number(), terminal: v.number() }),
    failed: v.number(),
    operationId: v.id("passengerImportOperations"),
    processed: v.number(),
    remaining: v.number(),
    roomSummary: importRoomSummaryValidator,
    rowCount: v.optional(v.number()),
    status: v.optional(
      v.union(v.literal("processing"), v.literal("completed"), v.literal("retryable"))
    ),
    updated: v.number(),
  })
    .index("by_operationId_batchIndex", ["operationId", "batchIndex"])
    .index("by_operationId_batchId", ["operationId", "batchId"])
    .index("by_operationId", ["operationId"]),

  passengerExportOperations: defineTable({
    attemptCount: v.number(),
    commandId: v.string(),
    completedAt: v.optional(v.number()),
    errorCode: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    exportKind: v.string(),
    fileName: v.optional(v.string()),
    initiatedBy: v.string(),
    initiatedByStaffId: v.optional(v.id("staffUsers")),
    jobCardId: v.id("jobCards"),
    jobCode: v.optional(v.string()),
    leaseExpiresAt: v.optional(v.number()),
    leaseId: v.optional(v.string()),
    rowsProcessed: v.number(),
    sourceChunkCount: v.optional(v.number()),
    sourceCursor: v.optional(v.string()),
    sourceDone: v.optional(v.boolean()),
    startedAt: v.number(),
    status: v.union(
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("expired")
    ),
    storageId: v.optional(v.id("_storage")),
    updatedAt: v.number(),
  })
    .index("by_initiatedBy_exportKind_jobCardId_commandId", [
      "initiatedBy",
      "exportKind",
      "jobCardId",
      "commandId",
    ])
    .index("by_initiatedBy_updatedAt", ["initiatedBy", "updatedAt"])
    .index("by_status_expiresAt", ["status", "expiresAt"])
    .index("by_storageId", ["storageId"]),

  passengerExportSourceChunks: defineTable({
    continueCursor: v.string(),
    createdAt: v.number(),
    cursorStart: v.string(),
    isDone: v.boolean(),
    operationId: v.id("passengerExportOperations"),
    pageIndex: v.number(),
    rowCount: v.number(),
    storageId: v.id("_storage"),
  })
    .index("by_operationId_pageIndex", ["operationId", "pageIndex"])
    .index("by_storageId", ["storageId"]),

  crmListSearchReadiness: defineTable({
    generation: v.optional(v.number()),
    ready: v.boolean(),
    reconciling: v.optional(v.boolean()),
    startedAt: v.optional(v.number()),
    table: v.string(),
    updatedAt: v.number(),
    version: v.optional(v.number()),
  }).index("by_table", ["table"]),

  crmListSearchDirty: defineTable({
    createdAt: v.number(),
    key: v.string(),
    sourceId: v.string(),
    table: v.union(
      v.literal("queries"),
      v.literal("jobCards"),
      v.literal("proposals"),
      v.literal("travellers")
    ),
    updatedAt: v.number(),
  })
    .index("by_key", ["key"])
    .index("by_updatedAt", ["updatedAt"]),

  crmMetricDirty: defineTable({
    createdAt: v.number(),
    cursor: v.optional(v.string()),
    key: v.string(),
    kind: v.union(v.literal("source"), v.literal("jobContext"), v.literal("queryContext")),
    sourceId: v.string(),
    sourceType: v.optional(
      v.union(
        v.literal("approvalRequests"),
        v.literal("expenseEntries"),
        v.literal("invoices"),
        v.literal("jobCards"),
        v.literal("pnrs"),
        v.literal("proposals"),
        v.literal("queries"),
        v.literal("tickets"),
        v.literal("travellers"),
        v.literal("visaRecords")
      )
    ),
    stage: v.optional(
      v.union(
        v.literal("expenseEntries"),
        v.literal("invoices"),
        v.literal("jobCards"),
        v.literal("pnrs"),
        v.literal("proposals"),
        v.literal("tickets"),
        v.literal("travellers"),
        v.literal("visaRecords")
      )
    ),
    updatedAt: v.number(),
  })
    .index("by_key", ["key"])
    .index("by_updatedAt", ["updatedAt"]),

  crmMetricBuckets: defineTable({
    periodKey: v.string(),
    periodType: v.union(v.literal("day"), v.literal("month")),
    scope: v.string(),
    updatedAt: v.number(),
    values: v.any(),
  }).index("by_scope_period", ["scope", "periodType", "periodKey"]),

  crmMetricProjections: defineTable({
    day: v.string(),
    fingerprint: v.string(),
    scopes: v.array(v.string()),
    sourceId: v.string(),
    sourceType: v.string(),
    updatedAt: v.number(),
    values: v.any(),
  })
    .index("by_source", ["sourceType", "sourceId"])
    .index("by_sourceType", ["sourceType"]),

  crmMetricPublications: defineTable({
    generation: v.number(),
    key: v.string(),
    metricVersion: v.number(),
    publishedAt: v.number(),
  }).index("by_key", ["key"]),

  crmMetricReadiness: defineTable({
    completedSourceTypes: v.array(v.string()),
    generation: v.number(),
    key: v.string(),
    lastCompletedAt: v.optional(v.number()),
    lastCompletedGeneration: v.optional(v.number()),
    lastCompletedMetricVersion: v.optional(v.number()),
    metricVersion: v.optional(v.number()),
    startedAt: v.number(),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),

  crmMetricReadinessSourceCompletions: defineTable({
    completedAt: v.number(),
    generation: v.number(),
    metricVersion: v.number(),
    sourceType: v.string(),
  })
    .index("by_generation", ["generation"])
    .index("by_generation_source", ["generation", "sourceType"]),

  // Small, durable checkpoints for deploy-time data repairs.  The registry
  // deliberately stores cursors and counters instead of an unbounded list so
  // a retry can resume without re-reading an entire table in one mutation.
  dataMigrationRegistry: defineTable({
    converted: v.number(),
    cursor: v.union(v.string(), v.null()),
    key: v.string(),
    legacyRemaining: v.number(),
    processed: v.number(),
    quarantined: v.optional(v.number()),
    stage: v.string(),
    startedAt: v.number(),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("verified"),
      v.literal("failed")
    ),
    updatedAt: v.number(),
    verifiedAt: v.optional(v.number()),
  }).index("by_key", ["key"]),

  // Review queue populated by the Staff-assignment dry run. Business records
  // are never patched by this inventory lane; ambiguous and unresolved rows
  // remain visible until a separately authorized reconciliation is applied.
  staffAssignmentIdentityQuarantines: defineTable({
    candidateStaffIds: v.array(v.id("staffUsers")),
    disposition: v.union(v.literal("ambiguous"), v.literal("unresolved")),
    field: v.string(),
    legacyName: v.string(),
    reason: v.string(),
    recordId: v.string(),
    recordLabel: v.string(),
    source: v.union(
      v.literal("queries"),
      v.literal("proposals"),
      v.literal("proposalQueryLinks"),
      v.literal("jobCards"),
      v.literal("travelBatches")
    ),
    stableOwnerId: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_source", ["source"])
    .index("by_source_record_field", ["source", "recordId", "field"]),

  dropdownOptions: defineTable({
    active: v.boolean(),
    category: v.string(),
    createdAt: v.number(),
    label: v.string(),
    sortOrder: v.number(),
    updatedAt: v.number(),
    value: v.string(),
  })
    .index("by_category", ["category"])
    .index("by_category_value", ["category", "value"]),

  eventFlows: defineTable({
    createdAt: v.number(),
    createdBy: v.string(),
    jobCardId: v.id("jobCards"),
    schedule: v.optional(v.any()),
    specialRequirements: v.optional(v.string()),
    title: v.string(),
    updatedAt: v.number(),
  }).index("by_jobCardId", ["jobCardId"]),

  expenseEntries: defineTable({
    amount: v.number(),
    approvalStatus,
    approvalVersion: v.optional(v.number()),
    cardAmount: v.optional(v.number()),
    cashAmount: v.optional(v.number()),
    category: v.string(),
    createdAt: v.number(),
    createdBy: v.string(),
    currency: v.optional(expenseCurrency),
    epayAmount: v.optional(v.number()),
    expenseDate: v.optional(v.string()),
    financeReviewedAt: v.optional(v.number()),
    financeReviewedBy: v.optional(v.string()),
    financeReviewedByName: v.optional(v.string()),
    financeReviewStatus: v.optional(reviewStatus),
    jobCardId: v.optional(v.id("jobCards")),
    managerApprovedProofDigest: v.optional(v.string()),
    managerApprovedVersion: v.optional(v.number()),
    managerApproverStaffId: v.optional(v.id("staffUsers")),
    managerReviewedAt: v.optional(v.number()),
    managerReviewedBy: v.optional(v.string()),
    managerReviewedByName: v.optional(v.string()),
    managerReviewStatus: v.optional(reviewStatus),
    notes: v.optional(v.string()),
    paidBy: v.string(),
    particulars: v.optional(v.string()),
    proofAttachmentId: v.optional(v.id("attachments")),
    proofDigest: v.optional(v.string()),
    reimbursementStatus: v.union(
      v.literal("Not Submitted"),
      v.literal("Pending"),
      v.literal("Reimbursed")
    ),
    submittedForApprovalAt: v.optional(v.number()),
    tourManagerName: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_jobCardId", ["jobCardId"])
    .index("by_approvalStatus", ["approvalStatus"])
    .index("by_createdAt", ["createdAt"]),

  e2eRuns: defineTable({
    completedAt: v.optional(v.number()),
    createdAt: v.number(),
    mutatedCount: v.number(),
    ownedCount: v.number(),
    runId: v.string(),
    status: v.union(v.literal("active"), v.literal("cleaning"), v.literal("complete")),
    target: v.union(v.literal("development"), v.literal("preview")),
    targetId: v.string(),
    updatedAt: v.number(),
  })
    .index("by_runId", ["runId"])
    .index("by_status_updatedAt", ["status", "updatedAt"]),

  e2eRunActors: defineTable({
    authUserId: v.string(),
    createdAt: v.number(),
    runId: v.string(),
    status: v.union(v.literal("active"), v.literal("complete")),
  })
    .index("by_authUserId_status", ["authUserId", "status"])
    .index("by_runId", ["runId"]),

  e2eOwnedRecords: defineTable({
    cleanupOrder: v.number(),
    createdAt: v.number(),
    documentId: v.string(),
    runId: v.string(),
    storageIds: v.array(v.id("_storage")),
    tableName: v.string(),
  })
    .index("by_runId_createdAt", ["runId", "createdAt"])
    .index("by_runId_cleanupOrder_createdAt", ["runId", "cleanupOrder", "createdAt"])
    .index("by_runId_tableName_documentId", ["runId", "tableName", "documentId"]),

  e2eMutatedRecords: defineTable({
    createdAt: v.number(),
    documentId: v.string(),
    originalValue: v.any(),
    runId: v.string(),
    tableName: v.string(),
  })
    .index("by_runId_createdAt", ["runId", "createdAt"])
    .index("by_runId_tableName_documentId", ["runId", "tableName", "documentId"]),

  flightGroups: defineTable({
    airline: v.string(),
    arrivalDate: v.optional(v.string()),
    createdAt: v.number(),
    createdBy: v.string(),
    departureDate: v.string(),
    flightNumber: v.string(),
    importKey: v.optional(v.string()),
    jobCardId: v.id("jobCards"),
    name: v.string(),
    route: v.string(),
    sourceGroupIndex: v.optional(v.number()),
    sourceSheet: v.optional(v.string()),
    ticketingType: v.optional(v.string()),
    totalSeats: v.number(),
    travelBatchId: v.optional(v.id("travelBatches")),
    updatedAt: v.number(),
  })
    .index("by_jobCardId", ["jobCardId"])
    .index("by_travelBatchId", ["travelBatchId"])
    .index("by_jobCardId_and_travelBatchId", ["jobCardId", "travelBatchId"])
    .index("by_jobCardId_importKey", ["jobCardId", "importKey"])
    .index("by_createdAt", ["createdAt"]),

  flightSegments: defineTable({
    airline: v.string(),
    arriveTime: v.optional(v.string()),
    createdAt: v.number(),
    createdBy: v.string(),
    dateLabel: v.string(),
    departTime: v.optional(v.string()),
    destination: v.string(),
    duration: v.optional(v.string()),
    flightGroupId: v.id("flightGroups"),
    flightNumber: v.string(),
    importKey: v.string(),
    jobCardId: v.id("jobCards"),
    origin: v.string(),
    segmentIndex: v.number(),
    sourceGroupIndex: v.number(),
    sourceRowNumber: v.optional(v.number()),
    sourceSheet: v.string(),
    transit: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_jobCardId", ["jobCardId"])
    .index("by_flightGroupId", ["flightGroupId"])
    .index("by_jobCardId_importKey", ["jobCardId", "importKey"]),

  hotels: defineTable({
    checkInDate: v.optional(v.string()),
    checkOutDate: v.optional(v.string()),
    city: v.optional(v.string()),
    createdAt: v.number(),
    createdBy: v.string(),
    earlyCheckIn: v.optional(v.boolean()),
    jobCardId: v.id("jobCards"),
    lateCheckout: v.optional(v.boolean()),
    name: v.string(),
    specialInstructions: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_jobCardId", ["jobCardId"])
    .index("by_createdAt", ["createdAt"]),

  inboundIntentRateLimits: defineTable({
    count: v.number(),
    expiresAt: v.number(),
    keyHash: v.string(),
    resetAt: v.number(),
  })
    .index("by_keyHash", ["keyHash"])
    .index("by_expiresAt", ["expiresAt"]),

  inboundQueryIntents: defineTable({
    clientName: v.string(),
    consentAt: v.number(),
    contactEmail: v.optional(v.string()),
    contactEmailNormalized: v.optional(v.string()),
    contactMobile: v.optional(v.string()),
    convertedAt: v.optional(v.number()),
    convertedQueryId: v.optional(v.string()),
    createdAt: v.number(),
    destination: v.optional(v.string()),
    dismissalReason: v.optional(
      v.union(
        v.literal("duplicate_enquiry"),
        v.literal("not_qualified"),
        v.literal("unable_to_reach")
      )
    ),
    dismissedAt: v.optional(v.number()),
    handoffEventId: v.optional(v.id("crmHandoffEvents")),
    isSynthetic: v.optional(v.boolean()),
    listSearchText: v.optional(v.string()),
    notes: v.optional(v.string()),
    paxCount: v.optional(v.number()),
    sacredBharatContext: v.optional(
      v.object({
        entryPoint: v.union(v.literal("journey_planner"), v.literal("trail")),
        templeId: v.optional(v.string()),
        trailSlug: v.optional(v.string()),
      })
    ),
    source: v.union(
      v.literal("Citius Concierge"),
      v.literal("Sacred Bharat"),
      v.literal("Website")
    ),
    status: v.union(v.literal("pending"), v.literal("converted"), v.literal("dismissed")),
    submissionKeyHash: v.optional(v.string()),
    syntheticTestSessionId: v.optional(v.id("operationalControlTestSessions")),
    travelStartDate: v.optional(v.string()),
    triagedAt: v.optional(v.number()),
    triagedByStaffId: v.optional(v.id("staffUsers")),
  })
    .index("by_status", ["status"])
    .index("by_createdAt", ["createdAt"])
    .index("by_status_createdAt", {
      fields: ["status", "createdAt"],
    })
    .index("by_status_source_createdAt", {
      fields: ["status", "source", "createdAt"],
    })
    .index("by_contactEmailNormalized", {
      fields: ["contactEmailNormalized"],
    })
    .index("by_submissionKeyHash", ["submissionKeyHash"])
    .index("by_submissionKeyHash_createdAt", ["submissionKeyHash", "createdAt"])
    .searchIndex("search_list", {
      filterFields: ["source", "status"],
      searchField: "listSearchText",
    }),

  invoices: defineTable({
    balanceAmount: v.number(),
    createdAt: v.number(),
    createdBy: v.string(),
    dueDate: v.optional(v.string()),
    expectedAmount: v.number(),
    generatedAt: v.optional(v.number()),
    // Optional only for the widening window. Invoice writers always project
    // this value and the bounded reconciliation verifies legacy rows before
    // outstanding reads switch to the compound index.
    hasOutstandingBalance: v.optional(v.boolean()),
    invoiceNumber: v.string(),
    jobCardId: v.id("jobCards"),
    receivedAmount: v.number(),
    status: v.union(
      v.literal("Draft"),
      v.literal("Generated"),
      v.literal("Part Paid"),
      v.literal("Paid"),
      v.literal("Overdue")
    ),
    updatedAt: v.number(),
  })
    .index("by_jobCardId", ["jobCardId"])
    .index("by_status", ["status"])
    .index("by_createdAt", ["createdAt"])
    .index("by_hasOutstandingBalance_and_createdAt", ["hasOutstandingBalance", "createdAt"]),

  invoiceOutstandingProjectionReadiness: defineTable({
    cursor: v.union(v.string(), v.null()),
    failureCode: v.optional(v.string()),
    generation: v.number(),
    key: v.literal("invoices.outstanding.v1"),
    processed: v.number(),
    ready: v.boolean(),
    residuals: v.number(),
    stage: v.union(v.literal("backfill"), v.literal("verify"), v.literal("complete")),
    startedAt: v.number(),
    status: v.union(v.literal("running"), v.literal("complete"), v.literal("failed")),
    updatedAt: v.number(),
    version: v.number(),
  }).index("by_key", ["key"]),

  itineraries: defineTable({
    content: v.optional(v.string()),
    createdAt: v.number(),
    createdBy: v.string(),
    frozen: v.boolean(),
    jobCardId: v.id("jobCards"),
    title: v.string(),
    updatedAt: v.number(),
    version: v.number(),
  }).index("by_jobCardId", ["jobCardId"]),

  commandReceipts: defineTable({
    actorKey: v.string(),
    commandId: v.string(),
    createdAt: v.number(),
    operation: v.string(),
    payloadDigest: v.string(),
    resultId: v.string(),
    targetId: v.string(),
  })
    .index("by_actorKey_operation_commandId", ["actorKey", "operation", "commandId"])
    .index("by_createdAt", ["createdAt"]),

  jobCardDeletionOperations: defineTable({
    completedAt: v.optional(v.number()),
    deletedCount: v.number(),
    failedAt: v.optional(v.number()),
    failureSummary: v.optional(v.string()),
    initiatedBy: v.string(),
    initiatedByStaffId: v.optional(v.id("staffUsers")),
    jobCardId: v.string(),
    jobCode: v.string(),
    lastProgressAt: v.number(),
    stage: v.string(),
    stageCounts: v.array(
      v.object({
        count: v.number(),
        stage: v.string(),
      })
    ),
    startedAt: v.number(),
    status: v.union(v.literal("running"), v.literal("complete"), v.literal("failed")),
  })
    .index("by_jobCardId", ["jobCardId"])
    .index("by_initiatedBy_startedAt", ["initiatedBy", "startedAt"]),

  jobCardDeletionWorkers: defineTable({
    completedAt: v.optional(v.number()),
    kind: v.union(v.literal("traveller"), v.literal("approval")),
    operationId: v.id("jobCardDeletionOperations"),
    status: v.union(v.literal("pending"), v.literal("running"), v.literal("complete")),
    workerKey: v.string(),
  })
    .index("by_operation_status", ["operationId", "status"])
    .index("by_operation_workerKey", ["operationId", "workerKey"]),

  jobCards: defineTable({
    airfarePerPax: v.optional(v.number()),
    approxMargin: v.optional(v.number()),
    clientName: v.string(),
    collaboratorStaffIds: v.optional(v.array(v.id("staffUsers"))),
    confirmedOfferId: v.optional(v.id("confirmedOffers")),
    confirmedPax: v.number(),
    contractingOwnerId: v.optional(v.string()),
    contractingOwnerName: v.optional(v.string()),
    createdAt: v.number(),
    createdBy: v.string(),
    destination: v.optional(v.string()),
    jobCode: v.string(),
    landCostPerPax: v.optional(v.number()),
    lastEditedAt: v.optional(v.number()),
    lastEditedBy: v.optional(v.string()),
    lastEditedByName: v.optional(v.string()),
    listSearchText: v.optional(v.string()),
    operationsOwnerId: v.optional(v.string()),
    operationsOwnerName: v.optional(v.string()),
    paymentTerms: v.optional(v.any()),
    preDepartureChecklist: v.optional(v.any()),
    profitPerPax: v.optional(v.number()),
    proposalId: v.optional(v.id("proposals")),
    queryId: v.optional(v.id("queries")),
    queryType: v.optional(queryType),
    roomCount: v.optional(v.number()),
    sellingPricePerPax: v.optional(v.number()),
    status: v.union(
      v.literal("Open"),
      v.literal("In Operations"),
      v.literal("Ready for Departure"),
      v.literal("On Tour"),
      v.literal("Closed")
    ),
    ticketingOwnerId: v.optional(v.string()),
    ticketingOwnerName: v.optional(v.string()),
    ticketingRequired: v.optional(v.boolean()),
    ticketingScope: v.optional(v.string()),
    tourManagerId: v.optional(v.id("tourManagerAssignments")),
    tourManagerName: v.optional(v.string()),
    tourManagerStaffId: v.optional(v.id("staffUsers")),
    travelBatchCount: v.optional(v.number()),
    travelBatchSummaries: v.optional(v.array(travelBatchSummaryTransitionValidator)),
    travelEndDate: v.optional(v.string()),
    travelStartDate: v.optional(v.string()),
    updatedAt: v.number(),
    visaCostPerPax: v.optional(v.number()),
  })
    .index("by_jobCode", ["jobCode"])
    .index("by_queryId", ["queryId"])
    .index("by_proposalId", ["proposalId"])
    .index("by_createdBy", ["createdBy"])
    .index("by_contractingOwnerId", ["contractingOwnerId"])
    .index("by_operationsOwnerId", ["operationsOwnerId"])
    .index("by_ticketingOwnerId", ["ticketingOwnerId"])
    .index("by_status", ["status"])
    .index("by_createdAt", ["createdAt"])
    .searchIndex("search_list", { searchField: "listSearchText" }),

  mealPreferences: defineTable({
    createdAt: v.number(),
    flightMealCode: v.optional(v.string()),
    foodPreference,
    notes: v.optional(v.string()),
    ticketId: v.optional(v.id("tickets")),
    travellerId: v.id("travellers"),
    updatedAt: v.number(),
  }).index("by_travellerId", ["travellerId"]),

  // Privacy-safe per-recipient delivery state for CRM email. Recipient
  // addresses are never stored here; the hash is derived from the provider
  // idempotency key and is only useful for distinguishing failed recipients.
  notificationEmailDeliveries: defineTable({
    attempts: v.number(),
    createdAt: v.number(),
    eventId: v.string(),
    failureCode: v.optional(v.string()),
    failureCountedStartedAt: v.optional(v.number()),
    idempotencyKey: v.string(),
    providerStatus: v.optional(v.number()),
    recipientHash: v.string(),
    sentAt: v.optional(v.number()),
    status: v.union(
      v.literal("queued"),
      v.literal("sending"),
      v.literal("retrying"),
      v.literal("sent"),
      v.literal("skipped"),
      v.literal("exhausted")
    ),
    summaryProjectedEventId: v.optional(v.string()),
    summaryProjectedStatus: v.optional(
      v.union(
        v.literal("queued"),
        v.literal("sending"),
        v.literal("retrying"),
        v.literal("sent"),
        v.literal("skipped"),
        v.literal("exhausted")
      )
    ),
    updatedAt: v.number(),
  })
    .index("by_deliveryKey", ["idempotencyKey"])
    .index("by_eventId", ["eventId"])
    .index("by_status_updatedAt", ["status", "updatedAt"])
    .index("by_updatedAt", ["updatedAt"]),

  // Exact, privacy-safe aggregate for Activity. Legacy delivery rows are
  // projected by a bounded backfill before the readiness row becomes ready.
  notificationEmailEventSummaries: defineTable({
    eventId: v.string(),
    exhausted: v.number(),
    queued: v.number(),
    retrying: v.number(),
    sending: v.number(),
    sent: v.number(),
    skipped: v.number(),
    total: v.number(),
    updatedAt: v.number(),
  })
    .index("by_eventId", ["eventId"])
    .index("by_updatedAt", ["updatedAt"]),

  // Authorization-safe origin for email events that may not have a matching
  // bell row. This stores staff identities only; recipient email addresses and
  // provider payloads remain outside the CRM ledger.
  notificationEmailEventOrigins: defineTable({
    audienceStaffIds: v.array(v.id("staffUsers")),
    audienceUserIds: v.array(v.string()),
    createdAt: v.number(),
    entityId: v.optional(v.string()),
    entityType: v.optional(v.string()),
    eventId: v.string(),
    label: v.string(),
  })
    .index("by_eventId", ["eventId"])
    .index("by_createdAt", ["createdAt"]),

  notificationEmailSummaryReadiness: defineTable({
    failureCode: v.optional(v.string()),
    generation: v.number(),
    key: v.string(),
    ready: v.boolean(),
    residuals: v.number(),
    scanned: v.number(),
    stage: v.union(v.literal("backfill"), v.literal("verify"), v.literal("complete")),
    startedAt: v.number(),
    status: v.union(v.literal("running"), v.literal("complete"), v.literal("failed")),
    updatedAt: v.number(),
    version: v.number(),
  }).index("by_key", ["key"]),

  notifications: defineTable({
    body: v.string(),
    createdAt: v.number(),
    entityId: v.optional(v.string()),
    entityType: v.optional(v.string()),
    projectionTargetKey: v.optional(v.string()),
    projectionVersion: v.optional(v.number()),
    readAt: v.optional(v.number()),
    recipientRole: v.optional(staffRole),
    recipientStaffId: v.optional(v.id("staffUsers")),
    recipientUserId: v.optional(v.string()),
    title: v.string(),
  })
    .index("by_recipientStaffId", ["recipientStaffId"])
    .index("by_recipientStaffId_createdAt", ["recipientStaffId", "createdAt"])
    .index("by_recipientUserId", ["recipientUserId"])
    .index("by_recipientRole", ["recipientRole"])
    .index("by_entity", ["entityType", "entityId"])
    .index("by_createdAt", ["createdAt"])
    .index("by_recipientUserId_createdAt", ["recipientUserId", "createdAt"])
    .index("by_recipientRole_createdAt", ["recipientRole", "createdAt"]),

  operationalControlAuditEvents: defineTable({
    action: v.union(
      v.literal("global_set"),
      v.literal("global_rollback"),
      v.literal("test_created"),
      v.literal("test_revoked"),
      v.literal("change_set_applied"),
      v.literal("change_set_restoration_failed"),
      v.literal("change_set_restored"),
      v.literal("change_set_undone"),
      v.literal("catalog_migrated"),
      v.literal("plane_activated")
    ),
    actorId: v.string(),
    actorName: v.string(),
    after: v.optional(
      v.object({
        expiresAt: v.optional(v.number()),
        state: v.union(
          v.literal("default"),
          v.literal("enabled"),
          v.literal("disabled"),
          v.literal("safe_default")
        ),
      })
    ),
    before: v.optional(
      v.object({
        expiresAt: v.optional(v.number()),
        state: v.union(
          v.literal("default"),
          v.literal("enabled"),
          v.literal("disabled"),
          v.literal("safe_default")
        ),
      })
    ),
    changeSetId: v.optional(v.id("operationalControlChangeSets")),
    commandId: v.string(),
    controlKey: v.optional(v.string()),
    createdAt: v.number(),
    initializedControlKeys: v.optional(v.array(v.string())),
    reason: v.string(),
    revision: v.optional(v.number()),
    rollbackOfAuditEventId: v.optional(v.id("operationalControlAuditEvents")),
    targetDeployment: v.optional(v.string()),
    targetEnvironment: v.optional(v.string()),
    targetRevision: v.optional(v.string()),
    testAfter: v.optional(
      v.union(
        v.object({ status: v.literal("absent") }),
        v.object({
          expiresAt: v.number(),
          overrideCount: v.number(),
          scope: v.literal("inbound_contact"),
          status: v.union(v.literal("active"), v.literal("revoked")),
        })
      )
    ),
    testBefore: v.optional(
      v.union(
        v.object({ status: v.literal("absent") }),
        v.object({
          expiresAt: v.number(),
          overrideCount: v.number(),
          scope: v.literal("inbound_contact"),
          status: v.union(v.literal("active"), v.literal("revoked")),
        })
      )
    ),
    testSessionId: v.optional(v.id("operationalControlTestSessions")),
  })
    .index("by_commandId", ["commandId"])
    .index("by_controlKey_createdAt", ["controlKey", "createdAt"])
    .index("by_createdAt", ["createdAt"])
    .index("by_testSessionId_createdAt", ["testSessionId", "createdAt"]),

  operationalControlStates: defineTable({
    changeSetId: v.optional(v.id("operationalControlChangeSets")),
    expiresAt: v.optional(v.number()),
    key: v.string(),
    reason: v.string(),
    revision: v.number(),
    state: v.union(
      v.literal("default"),
      v.literal("enabled"),
      v.literal("disabled"),
      v.literal("safe_default")
    ),
    updatedAt: v.number(),
    updatedBy: v.string(),
    updatedByName: v.string(),
  }).index("by_key", ["key"]),

  operationalControlChangeSets: defineTable({
    appliedAt: v.number(),
    appliedBy: v.string(),
    appliedByName: v.string(),
    auditEventId: v.id("operationalControlAuditEvents"),
    changes: v.array(
      v.object({
        after: v.object({
          state: v.union(v.literal("default"), v.literal("enabled"), v.literal("disabled")),
        }),
        appliedRevision: v.number(),
        before: v.object({
          expiresAt: v.optional(v.number()),
          state: v.union(
            v.literal("default"),
            v.literal("enabled"),
            v.literal("disabled"),
            v.literal("safe_default")
          ),
        }),
        beforeChangeSetId: v.optional(v.id("operationalControlChangeSets")),
        beforeRevision: v.number(),
        key: v.string(),
      })
    ),
    commandId: v.string(),
    reason: v.string(),
    resolutionReason: v.optional(v.string()),
    resolvedByName: v.optional(v.string()),
    restorationAt: v.optional(v.number()),
    restorationAuditEventId: v.optional(v.id("operationalControlAuditEvents")),
    restorationFailure: v.optional(v.string()),
    restoredAt: v.optional(v.number()),
    scheduledRestorationId: v.optional(v.id("_scheduled_functions")),
    status: v.union(
      v.literal("applied"),
      v.literal("restoration_failed"),
      v.literal("restored"),
      v.literal("undone")
    ),
    targetDeployment: v.string(),
    targetEnvironment: v.string(),
    targetRevision: v.string(),
    undoCommandId: v.optional(v.string()),
  })
    .index("by_commandId", ["commandId"])
    .index("by_appliedAt", ["appliedAt"])
    .index("by_status_restorationAt", ["status", "restorationAt"]),

  operationalControlPlaneState: defineTable({
    activatedAt: v.number(),
    activatedBy: v.string(),
    activatedByName: v.string(),
    key: v.literal("global"),
    reason: v.string(),
    revision: v.number(),
  }).index("by_key", ["key"]),

  // Compatibility-only storage for legacy isolated-test evidence. Runtime
  // creation and enforcement have been retired; the table remains readable
  // until a later verified contraction can remove existing rows safely.
  operationalControlTestSessions: defineTable({
    createdAt: v.number(),
    createdBy: v.string(),
    createdByName: v.string(),
    expiresAt: v.number(),
    overrides: v.array(
      v.object({
        key: v.string(),
        state: v.union(v.literal("enabled"), v.literal("disabled")),
      })
    ),
    reason: v.string(),
    revokedAt: v.optional(v.number()),
    revokedBy: v.optional(v.string()),
    scope: v.literal("inbound_contact"),
    tokenHash: v.string(),
  })
    .index("by_tokenHash", ["tokenHash"])
    .index("by_expiresAt", ["expiresAt"]),

  operationalEffectReceipts: defineTable({
    controlKey: v.string(),
    createdAt: v.number(),
    disposition: v.union(
      v.literal("created"),
      v.literal("duplicate"),
      v.literal("failed"),
      v.literal("not_applicable"),
      v.literal("queued"),
      v.literal("suppressed"),
      v.literal("throttled")
    ),
    effectId: v.string(),
    entityId: v.optional(v.string()),
    entityType: v.optional(v.string()),
    payloadFingerprint: v.optional(v.string()),
    reason: v.union(
      v.literal("configured_default"),
      v.literal("corrupt_safe_default"),
      v.literal("explicit_disabled"),
      v.literal("explicit_enabled"),
      v.literal("expired_safe_default"),
      v.literal("missing_safe_default"),
      v.literal("no_recipients"),
      v.literal("pre_activation_standard"),
      v.literal("prerequisite_disabled"),
      v.literal("test_override")
    ),
    recipientCount: v.optional(v.number()),
    synthetic: v.optional(v.boolean()),
    testSessionId: v.optional(v.id("operationalControlTestSessions")),
  })
    .index("by_effectId", ["effectId"])
    .index("by_controlKey_createdAt", ["controlKey", "createdAt"])
    .index("by_createdAt", ["createdAt"])
    .index("by_entity", ["entityType", "entityId"]),

  productionTestRuns: defineTable({
    actorId: v.string(),
    actorName: v.string(),
    commandId: v.string(),
    completedAt: v.optional(v.number()),
    note: v.optional(v.string()),
    recipeIds: v.array(productionTestRecipeIdValidator),
    results: v.optional(
      v.array(
        v.object({
          cleanup: v.union(v.literal("failed"), v.literal("passed")),
          detail: v.string(),
          durationMs: v.number(),
          label: v.string(),
          recipeId: productionTestRecipeIdValidator,
          recordedEffects: v.array(v.string()),
          status: v.union(v.literal("failed"), v.literal("passed"), v.literal("skipped")),
          steps: v.array(
            v.object({
              detail: v.string(),
              id: v.string(),
              label: v.string(),
              status: v.union(v.literal("failed"), v.literal("passed"), v.literal("skipped")),
            })
          ),
        })
      )
    ),
    startedAt: v.number(),
    status: v.union(v.literal("failed"), v.literal("passed"), v.literal("running")),
    targetDeployment: v.string(),
    targetEnvironment: v.string(),
    targetRevision: v.string(),
  })
    .index("by_commandId", ["commandId"])
    .index("by_completedAt", ["completedAt"])
    .index("by_actorId_status", ["actorId", "status"]),

  notificationReads: defineTable({
    authUserId: v.optional(v.string()),
    notificationId: v.id("notifications"),
    projectionIdentityKey: v.optional(v.string()),
    projectionTargetKey: v.optional(v.string()),
    projectionVersion: v.optional(v.number()),
    readAt: v.number(),
    staffId: v.optional(v.id("staffUsers")),
  })
    .index("by_notificationId", ["notificationId"])
    .index("by_notification_staff", ["notificationId", "staffId"])
    .index("by_notification_user", ["notificationId", "authUserId"])
    .index("by_staffId", ["staffId"])
    .index("by_authUserId", ["authUserId"]),

  notificationTargetCounts: defineTable({
    key: v.string(),
    total: v.number(),
    updatedAt: v.number(),
    version: v.number(),
  }).index("by_key", ["key"]),

  notificationReadTargetCounts: defineTable({
    identityKey: v.string(),
    key: v.string(),
    readCount: v.number(),
    targetKey: v.string(),
    updatedAt: v.number(),
    version: v.number(),
  })
    .index("by_key", ["key"])
    .index("by_identityKey", ["identityKey"]),

  notificationUnreadProjectionReadiness: defineTable({
    failureCode: v.optional(v.string()),
    generation: v.number(),
    key: v.string(),
    ready: v.boolean(),
    residuals: v.number(),
    scanned: v.number(),
    stage: v.union(
      v.literal("notifications"),
      v.literal("receipts"),
      v.literal("verifyNotifications"),
      v.literal("verifyReceipts"),
      v.literal("complete")
    ),
    startedAt: v.number(),
    status: v.union(v.literal("running"), v.literal("complete"), v.literal("failed")),
    updatedAt: v.number(),
    version: v.number(),
  }).index("by_key", ["key"]),

  offices: defineTable({
    active: v.boolean(),
    city: v.optional(v.string()),
    code: v.string(),
    createdAt: v.number(),
    name: v.string(),
    updatedAt: v.number(),
  }).index("by_code", ["code"]),

  passportDetails: defineTable({
    createdAt: v.number(),
    createdBy: v.string(),
    encryptedPayload: v.string(),
    expiryDate: v.optional(v.string()),
    fileName: v.optional(v.string()),
    lastFour: v.optional(v.string()),
    mimeType: v.optional(v.string()),
    passportNumberHash: v.optional(v.string()),
    status: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
    travellerId: v.id("travellers"),
    updatedAt: v.number(),
  })
    .index("by_travellerId", ["travellerId"])
    .index("by_passportNumberHash", ["passportNumberHash"])
    .index("by_storageId", ["storageId"]),

  paymentTerms: defineTable({
    createdAt: v.number(),
    label: v.string(),
    maxAdvancePercent: v.number(),
    minAdvancePercent: v.number(),
    queryType,
    updatedAt: v.number(),
  }).index("by_queryType", ["queryType"]),

  pnrs: defineTable({
    airline: v.string(),
    createdAt: v.number(),
    createdBy: v.string(),
    fareType: v.optional(v.string()),
    flightGroupId: v.optional(v.id("flightGroups")),
    issuedSeats: v.number(),
    jobCardId: v.id("jobCards"),
    pnrCode: v.string(),
    route: v.string(),
    status: v.optional(v.string()),
    totalSeats: v.number(),
    updatedAt: v.number(),
  })
    .index("by_jobCardId", ["jobCardId"])
    .index("by_pnrCode", ["pnrCode"])
    .index("by_createdAt", ["createdAt"]),

  portalSavedViews: defineTable({
    createdAt: v.number(),
    createdBy: v.string(),
    filterState: v.any(),
    isFavorite: v.boolean(),
    isPinnedToDashboard: v.boolean(),
    name: v.string(),
    ownerAuthUserId: v.optional(v.string()),
    ownerStaffId: v.optional(v.id("staffUsers")),
    pathname: v.string(),
    sharedRole: v.optional(staffRole),
    updatedAt: v.number(),
    view: v.string(),
  })
    .index("by_ownerAuthUserId", ["ownerAuthUserId"])
    .index("by_sharedRole", ["sharedRole"])
    .index("by_view", ["view"])
    .index("by_createdBy", ["createdBy"]),

  portalFileDownloadRateLimits: defineTable({
    authUserId: v.string(),
    count: v.number(),
    expiresAt: v.number(),
    startedAt: v.number(),
  })
    .index("by_authUserId", ["authUserId"])
    .index("by_expiresAt", ["expiresAt"]),

  // A single daily nudge run advances through bounded pages. Keeping the
  // cursor and counters in a row makes retries resumable and prevents a
  // cron invocation from collecting every CRM table in one transaction.
  portalWorkflowNudgeRuns: defineTable({
    checked: v.number(),
    consecutiveFailedRuns: v.optional(v.number()),
    continuationToken: v.optional(v.number()),
    cursor: v.union(v.string(), v.null()),
    failedAt: v.optional(v.number()),
    failureCode: v.optional(v.string()),
    failureCountedStartedAt: v.optional(v.number()),
    failureKind: v.optional(
      v.union(v.literal("deterministic"), v.literal("stale"), v.literal("transient"))
    ),
    failureMessage: v.optional(v.string()),
    key: v.string(),
    lastRetryAt: v.optional(v.number()),
    previousFailedAt: v.optional(v.number()),
    previousFailureCode: v.optional(v.string()),
    previousFailureKind: v.optional(
      v.union(v.literal("deterministic"), v.literal("stale"), v.literal("transient"))
    ),
    referenceNow: v.number(),
    retryCount: v.optional(v.number()),
    sent: v.number(),
    stage: v.union(
      v.literal("queries"),
      v.literal("jobCards"),
      v.literal("travellers"),
      v.literal("tickets"),
      v.literal("invoices"),
      v.literal("complete")
    ),
    staleAt: v.optional(v.number()),
    startedAt: v.number(),
    status: v.union(
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("stale")
    ),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),

  portalWorkflowRuleRuns: defineTable({
    entityId: v.string(),
    entityType: v.string(),
    lastTriggeredAt: v.number(),
    ruleKey: v.string(),
  })
    .index("by_ruleKey", ["ruleKey"])
    .index("by_entity", ["entityType", "entityId"])
    .index("by_rule_entity", ["ruleKey", "entityType", "entityId"]),

  portalWorkflowRules: defineTable({
    createdAt: v.number(),
    enabled: v.boolean(),
    key: v.string(),
    recipientRole: v.optional(staffRole),
    thresholdHours: v.optional(v.number()),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),

  proposalAttachments: defineTable({
    createdAt: v.number(),
    createdBy: v.string(),
    fileName: v.string(),
    fileSize: v.number(),
    mimeType: v.string(),
    orderId: v.optional(v.string()),
    proposalId: v.id("proposals"),
    storageId: v.id("_storage"),
  })
    .index("by_proposalId", ["proposalId"])
    .index("by_proposalId_and_createdAt_and_orderId", ["proposalId", "createdAt", "orderId"])
    .index("by_storageId", ["storageId"]),

  proposalAttachmentSummaryReadiness: defineTable({
    generation: v.number(),
    key: v.string(),
    ready: v.boolean(),
    reconciling: v.boolean(),
    startedAt: v.number(),
    updatedAt: v.number(),
    version: v.number(),
  }).index("by_key", ["key"]),

  proposalQueryLinks: defineTable({
    clientName: v.optional(v.string()),
    contractingOwnerId: v.optional(v.string()),
    contractingOwnerName: v.optional(v.string()),
    contractingOwnerNameNormalized: v.optional(v.string()),
    contractingStatus: v.optional(v.string()),
    createdAt: v.number(),
    createdBy: v.string(),
    handedOffAt: v.optional(v.number()),
    handedOffRevision: v.optional(v.number()),
    paxCount: v.optional(v.number()),
    proposalId: v.id("proposals"),
    queryCode: v.optional(v.string()),
    queryCreatedBy: v.optional(v.string()),
    queryId: v.id("queries"),
    queryType: v.optional(v.string()),
    revisionRequestedAt: v.optional(v.number()),
    salesOwnerId: v.optional(v.string()),
    salesOwnerName: v.optional(v.string()),
    salesOwnerNameNormalized: v.optional(v.string()),
    salesStatus: v.optional(v.string()),
    ticketingOwnerId: v.optional(v.string()),
    ticketingOwnerName: v.optional(v.string()),
    ticketingOwnerNameNormalized: v.optional(v.string()),
    ticketingScope: v.optional(v.string()),
  })
    .index("by_proposalId", ["proposalId"])
    .index("by_queryId", ["queryId"])
    .index("by_proposalId_and_queryId", ["proposalId", "queryId"])
    .index("by_proposalId_and_queryType", {
      fields: ["proposalId", "queryType"],
    })
    .index("by_proposalId_and_queryCreatedBy", {
      fields: ["proposalId", "queryCreatedBy"],
    })
    .index("by_proposalId_and_salesOwnerId", {
      fields: ["proposalId", "salesOwnerId"],
    })
    .index("by_proposalId_and_contractingOwnerId", {
      fields: ["proposalId", "contractingOwnerId"],
    })
    .index("by_proposalId_and_ticketingOwnerId", {
      fields: ["proposalId", "ticketingOwnerId"],
    })
    .index("by_proposalId_and_salesOwnerName", {
      fields: ["proposalId", "salesOwnerNameNormalized"],
    })
    .index("by_proposalId_and_contractingOwnerName", {
      fields: ["proposalId", "contractingOwnerNameNormalized"],
    })
    .index("by_proposalId_and_ticketingOwnerName", {
      fields: ["proposalId", "ticketingOwnerNameNormalized"],
    })
    .index("by_proposalId_and_salesStatus", {
      fields: ["proposalId", "salesStatus"],
    })
    .index("by_proposalId_and_contractingStatus", {
      fields: ["proposalId", "contractingStatus"],
    })
    .index("by_proposal_type_createdBy", {
      fields: ["proposalId", "queryType", "queryCreatedBy"],
    })
    .index("by_proposal_type_salesOwnerId", {
      fields: ["proposalId", "queryType", "salesOwnerId"],
    })
    .index("by_proposal_type_contractingOwnerId", {
      fields: ["proposalId", "queryType", "contractingOwnerId"],
    })
    .index("by_proposal_type_ticketingOwnerId", {
      fields: ["proposalId", "queryType", "ticketingOwnerId"],
    })
    .index("by_proposal_type_salesOwnerName", {
      fields: ["proposalId", "queryType", "salesOwnerNameNormalized"],
    })
    .index("by_proposal_type_contractingOwnerName", {
      fields: ["proposalId", "queryType", "contractingOwnerNameNormalized"],
    })
    .index("by_proposal_type_ticketingOwnerName", {
      fields: ["proposalId", "queryType", "ticketingOwnerNameNormalized"],
    }),

  proposalQueryHandoffs: defineTable({
    airfarePerPax: v.number(),
    clientName: v.string(),
    commandId: v.string(),
    costPrice: v.number(),
    handedOffAt: v.number(),
    handedOffBy: v.string(),
    itinerarySummary: v.string(),
    landCostPerPax: v.number(),
    proposalCode: v.string(),
    proposalId: v.id("proposals"),
    proposalRevision: v.number(),
    queryId: v.id("queries"),
    sellingPrice: v.number(),
    taxRate: v.optional(v.number()),
    visaCostPerPax: v.number(),
  })
    .index("by_proposalId_queryId_revision", ["proposalId", "queryId", "proposalRevision"])
    .index("by_queryId_handedOffAt", ["queryId", "handedOffAt"]),

  proposals: defineTable({
    airfarePerPax: v.optional(v.number()),
    attachmentCount: v.optional(v.number()),
    attachmentPreview: v.optional(
      v.array(
        v.object({
          createdAt: v.number(),
          fileName: v.string(),
          fileSize: v.number(),
          id: v.id("proposalAttachments"),
          mimeType: v.string(),
        })
      )
    ),
    attachmentSummaryGeneration: v.optional(v.number()),
    attachmentSummaryState: v.optional(
      v.union(v.literal("pending"), v.literal("reconciling"), v.literal("ready"))
    ),
    attachmentSummaryVersion: v.optional(v.number()),
    clientName: v.string(),
    collaboratorStaffIds: v.optional(v.array(v.id("staffUsers"))),
    costPrice: v.optional(v.number()),
    createdAt: v.number(),
    createdBy: v.string(),
    finalizedPdfFileName: v.optional(v.string()),
    finalizedPdfStorageId: v.optional(v.id("_storage")),
    finalizedPdfUploadedAt: v.optional(v.number()),
    finalizedPdfUploadedBy: v.optional(v.string()),
    itinerarySummary: v.optional(v.string()),
    landCostPerPax: v.optional(v.number()),
    lastEditedAt: v.optional(v.number()),
    lastEditedBy: v.optional(v.string()),
    lastEditedByName: v.optional(v.string()),
    linkedQueryCount: v.optional(v.number()),
    linkedQueryPreview: v.optional(
      v.array(
        v.object({
          clientName: v.string(),
          contractingOwnerId: v.string(),
          contractingOwnerName: v.string(),
          contractingOwnerNameNormalized: v.optional(v.string()),
          contractingStatus: v.string(),
          paxCount: v.number(),
          queryCode: v.string(),
          queryCreatedBy: v.string(),
          queryId: v.id("queries"),
          queryType: v.string(),
          salesOwnerId: v.string(),
          salesOwnerName: v.string(),
          salesOwnerNameNormalized: v.optional(v.string()),
          salesStatus: v.string(),
          ticketingOwnerId: v.string(),
          ticketingOwnerName: v.string(),
          ticketingOwnerNameNormalized: v.optional(v.string()),
          ticketingScope: v.string(),
        })
      )
    ),
    linkedQueryProjection: v.optional(
      v.array(
        v.object({
          clientName: v.string(),
          contractingOwnerId: v.string(),
          contractingOwnerName: v.string(),
          contractingStatus: v.string(),
          paxCount: v.number(),
          queryCode: v.string(),
          queryCreatedBy: v.string(),
          queryId: v.id("queries"),
          queryType: v.string(),
          salesOwnerId: v.string(),
          salesOwnerName: v.string(),
          salesStatus: v.string(),
          ticketingOwnerId: v.string(),
          ticketingOwnerName: v.string(),
          ticketingScope: v.string(),
        })
      )
    ),
    linkedQuerySummaryGeneration: v.optional(v.number()),
    linkedQuerySummaryState: v.optional(
      v.union(v.literal("pending"), v.literal("reconciling"), v.literal("ready"))
    ),
    linkedQuerySummaryVersion: v.optional(v.number()),
    listSearchText: v.optional(v.string()),
    preparedBy: v.string(),
    preparedByStaffId: v.optional(v.id("staffUsers")),
    pricingEnteredAt: v.optional(v.number()),
    proposalCode: v.string(),
    proposalRevision: v.optional(v.number()),
    queryId: v.optional(v.id("queries")),
    sellingPrice: v.optional(v.number()),
    sentAt: v.optional(v.number()),
    sentToClientAt: v.optional(v.number()),
    sentToSalesAt: v.optional(v.number()),
    status: v.union(
      v.literal("Draft"),
      v.literal("Sent"),
      v.literal("Accepted"),
      v.literal("Rejected")
    ),
    taxRate: v.optional(v.number()),
    updatedAt: v.number(),
    visaCostPerPax: v.optional(v.number()),
  })
    .index("by_queryId", ["queryId"])
    .index("by_createdBy", ["createdBy"])
    .index("by_status", ["status"])
    .index("by_finalizedPdfStorageId", ["finalizedPdfStorageId"])
    .index("by_createdAt", ["createdAt"])
    .searchIndex("search_list", { searchField: "listSearchText" }),

  queries: defineTable({
    acceptedProposalId: v.optional(v.id("proposals")),
    approxMargin: v.optional(v.number()),
    attachmentCount: v.optional(v.number()),
    attachmentPreview: v.optional(
      v.array(
        v.object({
          createdAt: v.number(),
          fileName: v.string(),
          fileSize: v.number(),
          id: v.id("queryAttachments"),
          mimeType: v.string(),
        })
      )
    ),
    batchingNotes: v.optional(v.string()),
    budgetAmount: v.optional(v.number()),
    clientId: v.optional(v.id("clients")),
    clientName: v.string(),
    commercialProjectionGeneration: v.optional(v.number()),
    commercialProjectionState: v.optional(
      v.union(v.literal("pending"), v.literal("reconciling"), v.literal("ready"))
    ),
    commercialProjectionVersion: v.optional(v.number()),
    confirmedAt: v.optional(v.number()),
    confirmedOfferId: v.optional(v.id("confirmedOffers")),
    contactMobile: v.optional(v.string()),
    contactPerson: v.optional(v.string()),
    contractingAirlinesCost: v.optional(v.number()),
    contractingLandCost: v.optional(v.number()),
    contractingOwnerId: v.optional(v.string()),
    contractingOwnerName: v.optional(v.string()),
    contractingStatus,
    contractingVisaCost: v.optional(v.number()),
    createdAt: v.number(),
    createdBy: v.string(),
    destination: v.optional(v.string()),
    inboundIntentId: v.optional(v.id("inboundQueryIntents")),
    jobCardCreatorName: v.optional(v.string()),
    jobCardCreatorStaffId: v.optional(v.id("staffUsers")),
    jobCardPreview: v.optional(
      v.object({
        jobCardCode: v.string(),
        jobCardId: v.id("jobCards"),
      })
    ),
    leadStage: v.optional(leadStage),
    listSearchText: v.optional(v.string()),
    lostReason: v.optional(lostReason),
    lostReasonOther: v.optional(v.string()),
    notes: v.optional(v.string()),
    paxCount: v.number(),
    proposalDocumentPreview: v.optional(
      v.object({
        fileName: v.string(),
        proposalId: v.id("proposals"),
        uploadedAt: v.optional(v.number()),
      })
    ),
    proposalPreview: v.optional(
      v.object({
        costPrice: v.number(),
        handedOffRevision: v.optional(v.number()),
        proposalCode: v.string(),
        proposalId: v.id("proposals"),
        proposalRevision: v.optional(v.number()),
        status: v.string(),
        updatedAt: v.number(),
      })
    ),
    queryCode: v.string(),
    queryType,
    reassignToTeams: v.optional(v.boolean()),
    salesOwnerId: v.optional(v.string()),
    salesOwnerName: v.optional(v.string()),
    salesStatus,
    source: v.optional(querySource),
    sourceConsentAt: v.optional(v.number()),
    submittedToContractingAt: v.optional(v.number()),
    ticketingOwnerId: v.optional(v.string()),
    ticketingOwnerName: v.optional(v.string()),
    ticketingScope: v.optional(ticketingScope),
    travelEndDate: v.optional(v.string()),
    travelInBatches: v.optional(v.boolean()),
    travelStartDate: v.optional(v.string()),
    travelType,
    updatedAt: v.number(),
  })
    .index("by_queryCode", ["queryCode"])
    .index("by_clientId", { fields: ["clientId"] })
    .index("by_salesStatus", ["salesStatus"])
    .index("by_contractingStatus", ["contractingStatus"])
    .index("by_createdBy", ["createdBy"])
    .index("by_salesOwnerId", ["salesOwnerId"])
    .index("by_contractingOwnerId", ["contractingOwnerId"])
    .index("by_ticketingOwnerId", ["ticketingOwnerId"])
    .index("by_queryType_createdAt", ["queryType", "createdAt"])
    .index("by_createdAt", ["createdAt"])
    .searchIndex("search_list", { searchField: "listSearchText" }),

  queryCommercialProjectionReadiness: defineTable({
    completedCount: v.optional(v.number()),
    generation: v.number(),
    key: v.string(),
    ready: v.boolean(),
    reconciling: v.boolean(),
    scheduledCount: v.optional(v.number()),
    schedulingComplete: v.boolean(),
    startedAt: v.number(),
    updatedAt: v.number(),
    version: v.number(),
  }).index("by_key", ["key"]),

  queryCommercialProjectionWorkers: defineTable({
    bestAcceptedProposal: v.optional(
      v.object({
        costPrice: v.number(),
        handedOffRevision: v.optional(v.number()),
        proposalCode: v.string(),
        proposalId: v.id("proposals"),
        proposalRevision: v.optional(v.number()),
        status: v.string(),
        updatedAt: v.number(),
      })
    ),
    bestDocument: v.optional(
      v.object({
        fileName: v.string(),
        proposalId: v.id("proposals"),
        rank: v.number(),
        updatedAt: v.number(),
        uploadedAt: v.optional(v.number()),
      })
    ),
    bestProposal: v.optional(
      v.object({
        costPrice: v.number(),
        handedOffRevision: v.optional(v.number()),
        proposalCode: v.string(),
        proposalId: v.id("proposals"),
        proposalRevision: v.optional(v.number()),
        status: v.string(),
        updatedAt: v.number(),
      })
    ),
    cursor: v.optional(v.string()),
    generation: v.number(),
    queryId: v.id("queries"),
    status: v.union(v.literal("pending"), v.literal("running"), v.literal("complete")),
    updatedAt: v.number(),
  })
    .index("by_queryId", ["queryId"])
    .index("by_status", ["status"]),

  queryAttachments: defineTable({
    createdAt: v.number(),
    createdBy: v.string(),
    fileName: v.string(),
    fileSize: v.number(),
    mimeType: v.string(),
    queryId: v.id("queries"),
    storageId: v.id("_storage"),
  })
    .index("by_queryId", ["queryId"])
    .index("by_queryId_createdAt", ["queryId", "createdAt"])
    .index("by_storageId", ["storageId"]),

  roleDefinitions: defineTable({
    createdAt: v.number(),
    description: v.optional(v.string()),
    permissions: v.array(v.string()),
    role: staffRole,
    updatedAt: v.number(),
  }).index("by_role", ["role"]),

  roomingListEntries: defineTable({
    createdAt: v.number(),
    createdBy: v.string(),
    hotelId: v.optional(v.id("hotels")),
    jobCardId: v.id("jobCards"),
    notes: v.optional(v.string()),
    roomNumber: v.optional(v.string()),
    roomType,
    sharingWith: v.optional(v.string()),
    travellerId: v.optional(v.id("travellers")),
    updatedAt: v.number(),
  })
    .index("by_jobCardId", ["jobCardId"])
    .index("by_travellerId", ["travellerId"]),

  sacredBharatGroupMembers: defineTable({
    authUserId: v.string(),
    groupId: v.id("sacredBharatGroups"),
    joinedAt: v.number(),
    role: v.union(v.literal("owner"), v.literal("member")),
  })
    .index("by_groupId", ["groupId"])
    .index("by_authUserId", ["authUserId"])
    .index("by_groupId_authUserId", ["groupId", "authUserId"]),

  // One compact row per participant keeps leaderboard reads proportional to
  // the number of players rather than every visit event. Rows are refreshed
  // by the visit/profile mutations and can be backfilled independently.
  sacredBharatLeaderboardSummaries: defineTable({
    authUserId: v.string(),
    completedTrailCount: v.number(),
    displayName: v.string(),
    levelSlug: v.string(),
    levelTitle: v.string(),
    optedOut: v.boolean(),
    passportSlug: v.union(v.string(), v.null()),
    score: v.number(),
    templeCount: v.number(),
    updatedAt: v.number(),
  })
    .index("by_authUserId", ["authUserId"])
    .index("by_score", ["score", "templeCount", "authUserId"]),

  sacredBharatGroups: defineTable({
    createdAt: v.number(),
    inviteCode: v.string(),
    isArchived: v.boolean(),
    // Optional while sacred-bharat-group-count-v1 is backfilled and verified.
    memberCount: v.optional(v.number()),
    name: v.string(),
    ownerAuthUserId: v.string(),
    updatedAt: v.number(),
  })
    .index("by_ownerAuthUserId", ["ownerAuthUserId"])
    .index("by_inviteCode", ["inviteCode"]),

  sacredBharatInviteAttempts: defineTable({
    attemptCount: v.number(),
    authUserId: v.string(),
    updatedAt: v.number(),
    windowStartedAt: v.number(),
  }).index("by_authUserId", ["authUserId"]),

  sacredBharatProfiles: defineTable({
    authUserId: v.string(),
    bio: v.optional(v.string()),
    createdAt: v.number(),
    displayName: v.string(),
    homeCity: v.optional(v.string()),
    isPublic: v.boolean(),
    shareRecentVisits: v.boolean(),
    shareWishlist: v.boolean(),
    slug: v.string(),
    updatedAt: v.number(),
  })
    .index("by_authUserId", ["authUserId"])
    .index("by_slug", ["slug"])
    .index("by_isPublic", ["isPublic"]),

  sacredBharatVisits: defineTable({
    authUserId: v.string(),
    citiusBookingId: v.optional(v.id("bookings")),
    note: v.optional(v.string()),
    source: v.optional(v.union(v.literal("self"), v.literal("citius_booking"))),
    templeId: v.string(),
    visitedAt: v.number(),
    visitedOn: v.optional(v.string()),
  })
    .index("by_authUserId", ["authUserId"])
    .index("by_authUserId_templeId", ["authUserId", "templeId"]),

  sacredBharatWishlist: defineTable({
    authUserId: v.string(),
    createdAt: v.number(),
    itemId: v.string(),
    itemType: v.union(v.literal("temple"), v.literal("trail")),
  })
    .index("by_authUserId", ["authUserId"])
    .index("by_authUserId_item", ["authUserId", "itemType", "itemId"]),

  // Anonymous Edition 001 product analytics. This intentionally remains
  // separate from legacy Yatri identity, progress, visit, and wishlist data.
  sacredBharatEditionEvents: defineTable({
    attributedReferrerPlayerTokenHash: v.optional(v.string()),
    attributionExpiresAt: v.optional(v.number()),
    correct: v.optional(v.boolean()),
    createdAt: v.number(),
    edition: v.literal("001"),
    event: v.union(
      v.literal("edition_started"),
      v.literal("question_answered"),
      v.literal("edition_completed"),
      v.literal("share_clicked"),
      v.literal("share_link_copied"),
      v.literal("result_downloaded"),
      v.literal("journey_cta_clicked"),
      v.literal("edition_restarted")
    ),
    eventId: v.string(),
    playerTokenHash: v.string(),
    questionId: v.optional(
      v.union(
        v.literal("varanasi"),
        v.literal("amritsar"),
        v.literal("madurai"),
        v.literal("kedarnath"),
        v.literal("konark")
      )
    ),
    referrerTokenHash: v.optional(v.string()),
    score: v.optional(v.number()),
    shareTokenHash: v.optional(v.string()),
    style: v.optional(v.union(v.literal("archive"), v.literal("temple-red"), v.literal("monsoon"))),
  })
    .index("by_eventId", ["eventId"])
    .index("by_playerTokenHash_createdAt", ["playerTokenHash", "createdAt"])
    .index("by_shareTokenHash", ["shareTokenHash"])
    .index("by_edition_createdAt", ["edition", "createdAt"]),

  sacredBharatRateLimitKeys: defineTable({
    cleanupAfter: v.number(),
    keyHash: v.string(),
    lastSeenAt: v.number(),
  })
    .index("by_keyHash", ["keyHash"])
    .index("by_cleanupAfter", ["cleanupAfter"]),

  seatAllocations: defineTable({
    createdAt: v.number(),
    createdBy: v.string(),
    flightGroupId: v.optional(v.id("flightGroups")),
    jobCardId: v.id("jobCards"),
    notes: v.optional(v.string()),
    pnrId: v.optional(v.id("pnrs")),
    seatNumber: v.string(),
    status: v.union(
      v.literal("Available"),
      v.literal("Held"),
      v.literal("Assigned"),
      v.literal("Blocked")
    ),
    travellerId: v.optional(v.id("travellers")),
    updatedAt: v.number(),
  })
    .index("by_jobCardId", ["jobCardId"])
    .index("by_pnrId", ["pnrId"])
    .index("by_travellerId", ["travellerId"])
    .index("by_createdAt", ["createdAt"]),

  staffLeaveBalances: defineTable({
    accruedDays: v.number(),
    availableDays: v.number(),
    carriedForwardDays: v.number(),
    encashableDays: v.number(),
    fiscalYear: v.string(),
    leaveType,
    openingDays: v.number(),
    staffId: v.id("staffUsers"),
    updatedAt: v.number(),
    usedDays: v.number(),
  })
    .index("by_staffId", ["staffId"])
    .index("by_staffId_and_fiscalYear", ["staffId", "fiscalYear"])
    .index("by_staffId_and_fiscalYear_and_leaveType", ["staffId", "fiscalYear", "leaveType"]),

  staffLeaveLedger: defineTable({
    createdAt: v.number(),
    createdBy: v.string(),
    days: v.number(),
    entryType: v.union(
      v.literal("opening"),
      v.literal("accrual"),
      v.literal("usage"),
      v.literal("reversal"),
      v.literal("lapse"),
      v.literal("carry_forward"),
      v.literal("encashment")
    ),
    fiscalYear: v.string(),
    leaveRecordId: v.optional(v.id("staffLeaveRecords")),
    leaveType,
    note: v.optional(v.string()),
    staffId: v.id("staffUsers"),
  })
    .index("by_staffId", ["staffId"])
    .index("by_staffId_and_fiscalYear", ["staffId", "fiscalYear"])
    .index("by_staffId_and_fiscalYear_and_leaveType", ["staffId", "fiscalYear", "leaveType"])
    .index("by_staffId_and_fiscalYear_and_leaveType_and_entryType", [
      "staffId",
      "fiscalYear",
      "leaveType",
      "entryType",
    ])
    .index("by_leaveRecordId", ["leaveRecordId"]),

  staffLeaveLapseRuns: defineTable({
    completedAt: v.optional(v.number()),
    continuation: v.number(),
    createdAt: v.number(),
    cursor: v.optional(v.string()),
    cutoffAt: v.number(),
    failureCode: v.optional(v.string()),
    fiscalYear: v.string(),
    generation: v.number(),
    initiatedBy: v.string(),
    lapsedRows: v.number(),
    processedStaff: v.number(),
    startedAt: v.optional(v.number()),
    status: v.union(
      v.literal("queued"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed")
    ),
    trigger: v.union(v.literal("automatic"), v.literal("manual")),
    updatedAt: v.number(),
  })
    .index("by_fiscalYear_generation", ["fiscalYear", "generation"])
    .index("by_status_updatedAt", ["status", "updatedAt"]),

  staffLeaveLapseState: defineTable({
    activeRunId: v.optional(v.id("staffLeaveLapseRuns")),
    fiscalYear: v.string(),
    generation: v.number(),
    updatedAt: v.number(),
  }).index("by_fiscalYear", ["fiscalYear"]),

  staffLeaveRecords: defineTable({
    createdAt: v.number(),
    createdBy: v.string(),
    decisionNote: v.optional(v.string()),
    endDate: v.string(),
    finalAuthorityName: v.optional(v.string()),
    finalAuthorityStaffId: v.optional(v.id("staffUsers")),
    finalDecisionNote: v.optional(v.string()),
    finalReviewedAt: v.optional(v.number()),
    finalReviewedBy: v.optional(v.string()),
    finalReviewedByName: v.optional(v.string()),
    finalReviewStatus: v.optional(reviewStatus),
    headApproverName: v.optional(v.string()),
    headApproverStaffId: v.optional(v.id("staffUsers")),
    headDecisionNote: v.optional(v.string()),
    headReviewedAt: v.optional(v.number()),
    headReviewedBy: v.optional(v.string()),
    headReviewedByName: v.optional(v.string()),
    headReviewerRole: v.optional(staffRole),
    headReviewStatus: v.optional(reviewStatus),
    hrCopyName: v.optional(v.string()),
    hrCopyStaffId: v.optional(v.id("staffUsers")),
    hrReviewedAt: v.optional(v.number()),
    hrReviewedBy: v.optional(v.string()),
    hrReviewedByName: v.optional(v.string()),
    hrReviewStatus: v.optional(reviewStatus),
    leaveType: v.optional(leaveType),
    reason: v.string(),
    staffId: v.id("staffUsers"),
    startDate: v.string(),
    status: reviewStatus,
    updatedAt: v.number(),
  })
    .index("by_staffId", ["staffId"])
    .index("by_status", ["status"])
    .index("by_headReviewStatus", ["headReviewStatus"])
    .index("by_hrReviewStatus", ["hrReviewStatus"])
    .index("by_startDate", ["startDate"])
    .index("by_createdAt", ["createdAt"]),

  staffUsers: defineTable({
    active: v.boolean(),
    authUserId: v.optional(v.string()),
    confirmationDate: v.optional(v.string()),
    createdAt: v.number(),
    department: v.optional(v.string()),
    email: v.string(),
    emailAlertRoles: v.optional(v.array(staffRole)),
    emailNormalized: v.string(),
    employmentStatus: v.optional(v.union(v.literal("Probationer"), v.literal("Confirmed"))),
    function: v.optional(v.string()),
    invitedBy: v.optional(v.string()),
    jobCardCreatorEnabled: v.optional(v.boolean()),
    joiningDate: v.optional(v.string()),
    lastSeenAt: v.optional(v.number()),
    leaveEscalationApproverName: v.optional(v.string()),
    leaveEscalationApproverStaffId: v.optional(v.id("staffUsers")),
    leaveFinalAuthorityName: v.optional(v.string()),
    leaveFinalAuthorityStaffId: v.optional(v.id("staffUsers")),
    leaveHeadApproverId: v.optional(v.id("staffUsers")),
    leaveHrCopyName: v.optional(v.string()),
    leaveHrCopyStaffId: v.optional(v.id("staffUsers")),
    leaveLevel1ApproverName: v.optional(v.string()),
    leaveLevel1ApproverStaffId: v.optional(v.id("staffUsers")),
    leavePolicyGroup: v.optional(v.string()),
    location: v.optional(v.string()),
    marriageLeaveUsed: v.optional(v.boolean()),
    maternityEventsUsed: v.optional(v.number()),
    mobile: v.optional(v.string()),
    name: v.string(),
    officeId: v.optional(v.id("offices")),
    paternityEventsUsed: v.optional(v.number()),
    pendingPasswordSetup: v.optional(v.boolean()),
    reportingManagerName: v.optional(v.string()),
    reportingManagerStaffId: v.optional(v.id("staffUsers")),
    roles: v.array(staffRole),
    updatedAt: v.number(),
  })
    .index("by_emailNormalized", ["emailNormalized"])
    .index("by_active", ["active"])
    .index("by_active_and_createdAt", ["active", "createdAt"])
    .index("by_authUserId", ["authUserId"])
    .index("by_name", ["name"]),

  tickets: defineTable({
    cabinClass: v.optional(v.string()),
    cancellationStatus: v.optional(v.string()),
    createdAt: v.number(),
    createdBy: v.string(),
    jobCardId: v.id("jobCards"),
    mealPreference: v.optional(foodPreference),
    nameChangeStatus: v.optional(v.string()),
    paymentType,
    pnrId: v.optional(v.id("pnrs")),
    refundStatus: v.optional(v.string()),
    reissueStatus: v.optional(v.string()),
    seatNumber: v.optional(v.string()),
    seatPreference: v.optional(v.string()),
    ticketNumber: v.optional(v.string()),
    ticketStatus,
    ticketType: v.optional(v.union(v.literal("FIT Ticket"), v.literal("Group Ticket"))),
    travellerId: v.optional(v.id("travellers")),
    updatedAt: v.number(),
  })
    .index("by_jobCardId", ["jobCardId"])
    .index("by_travellerId", ["travellerId"])
    .index("by_pnrId", ["pnrId"])
    .index("by_ticketStatus", ["ticketStatus"])
    .index("by_createdAt", ["createdAt"]),

  tourManagerAssignments: defineTable({
    availabilityDate: v.optional(v.string()),
    callingStatus,
    createdAt: v.number(),
    createdBy: v.string(),
    email: v.optional(v.string()),
    jobCardId: v.optional(v.id("jobCards")),
    languages: v.optional(v.array(v.string())),
    name: v.string(),
    notes: v.optional(v.string()),
    phone: v.optional(v.string()),
    reportingInstructions: v.optional(v.string()),
    staffId: v.optional(v.id("staffUsers")),
    status: v.union(v.literal("Available"), v.literal("Assigned"), v.literal("Inactive")),
    travelBatchId: v.optional(v.id("travelBatches")),
    updatedAt: v.number(),
  })
    .index("by_jobCardId", ["jobCardId"])
    .index("by_travelBatchId", ["travelBatchId"])
    .index("by_jobCardId_and_travelBatchId", ["jobCardId", "travelBatchId"])
    .index("by_status", ["status"])
    .index("by_createdAt", ["createdAt"]),

  travelBatches: defineTable({
    batchCode: v.string(),
    batchReference: v.string(),
    confirmedPax: v.number(),
    contractingOwnerId: v.optional(v.string()),
    contractingOwnerName: v.optional(v.string()),
    createdAt: v.number(),
    createdBy: v.string(),
    destination: v.optional(v.string()),
    jobCardId: v.id("jobCards"),
    lastEditedAt: v.optional(v.number()),
    lastEditedBy: v.optional(v.string()),
    lastEditedByName: v.optional(v.string()),
    operationsOwnerId: v.optional(v.string()),
    operationsOwnerName: v.optional(v.string()),
    paymentTerms: v.optional(v.any()),
    preDepartureChecklist: v.optional(v.any()),
    queryType: v.optional(queryType),
    roomCount: v.optional(v.number()),
    status: v.union(
      v.literal("Open"),
      v.literal("In Operations"),
      v.literal("Ready for Departure"),
      v.literal("On Tour"),
      v.literal("Closed")
    ),
    ticketingOwnerId: v.optional(v.string()),
    ticketingOwnerName: v.optional(v.string()),
    tourManagerId: v.optional(v.id("tourManagerAssignments")),
    tourManagerName: v.optional(v.string()),
    tourManagerStaffId: v.optional(v.id("staffUsers")),
    travelEndDate: v.optional(v.string()),
    travelStartDate: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_jobCardId", ["jobCardId"])
    .index("by_jobCardId_and_batchCode", ["jobCardId", "batchCode"])
    .index("by_jobCardId_and_createdAt", ["jobCardId", "createdAt"])
    .index("by_batchReference", ["batchReference"])
    .index("by_status", ["status"])
    .index("by_createdAt", ["createdAt"]),

  travelHubs: defineTable({
    active: v.boolean(),
    code: v.optional(v.string()),
    createdAt: v.number(),
    name: v.string(),
    updatedAt: v.number(),
  }).index("by_name", ["name"]),

  travellers: defineTable({
    arrivingEarly: v.optional(v.boolean()),
    biometricAppointmentDate: v.optional(v.string()),
    callingStatus,
    cancellation: v.optional(v.boolean()),
    contactNo: v.optional(v.string()),
    createdAt: v.number(),
    createdBy: v.string(),
    domesticTravelRequired: v.optional(v.boolean()),
    extensionOfTour: v.optional(v.boolean()),
    foodPreference,
    fullName: v.string(),
    gender: v.optional(v.string()),
    givenName: v.optional(v.string()),
    guestCompanions: v.optional(v.string()),
    guestType,
    hasPassportScan: v.optional(v.boolean()),
    hotelAllocation: v.optional(v.string()),
    importKey: v.optional(v.string()),
    importSource: v.optional(v.string()),
    jobCardId: v.id("jobCards"),
    lastMinuteDrop: v.optional(v.boolean()),
    listSearchText: v.optional(v.string()),
    passportExpiryDate: v.optional(v.string()),
    passportStatus: v.optional(v.string()),
    paymentType,
    roomType,
    sourceDealerCode: v.optional(v.string()),
    sourceDealerName: v.optional(v.string()),
    sourceDescription: v.optional(v.string()),
    sourceGroup: v.optional(v.string()),
    sourceRowNumber: v.optional(v.number()),
    sourceRsoName: v.optional(v.string()),
    sourceSheet: v.optional(v.string()),
    sourceSoName: v.optional(v.string()),
    specialRequests: v.optional(v.string()),
    surname: v.optional(v.string()),
    ticketStatus,
    travelBatchCode: v.optional(v.string()),
    travelBatchId: v.optional(v.id("travelBatches")),
    travelBatchReference: v.optional(v.string()),
    travelDate: v.optional(v.string()),
    travelHub: v.optional(v.string()),
    updatedAt: v.number(),
    visaRequired: v.boolean(),
    visaStatus,
  })
    .index("by_jobCardId", ["jobCardId"])
    .index("by_jobCardId_createdAt", ["jobCardId", "createdAt"])
    .index("by_createdAt", ["createdAt"])
    .index("by_travelBatchId", ["travelBatchId"])
    .index("by_jobCardId_and_travelBatchId", ["jobCardId", "travelBatchId"])
    .index("by_jobCardId_importKey", ["jobCardId", "importKey"])
    .index("by_visaStatus", ["visaStatus"])
    .index("by_ticketStatus", ["ticketStatus"])
    .searchIndex("search_list", { searchField: "listSearchText" }),

  trips: defineTable({
    availableSeats: v.number(),
    coverImage: v.optional(v.string()),
    createdAt: v.number(),
    description: v.optional(v.string()),
    difficulty: v.optional(v.string()),
    endDate: v.string(),
    exclusions: v.optional(v.any()),
    gallery: v.optional(v.any()),
    inclusions: v.optional(v.any()),
    isActive: v.boolean(),
    itinerary: v.optional(v.any()),
    legacyTripId: v.optional(v.string()),
    name: v.string(),
    priceInr: v.number(),
    priceUsd: v.number(),
    slug: v.string(),
    startDate: v.string(),
    totalSeats: v.number(),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_legacyTripId", ["legacyTripId"])
    .index("by_isActive_startDate", ["isActive", "startDate"]),
  userProfiles: defineTable({
    archivedAt: v.optional(v.number()),
    archivedAuthUserId: v.optional(v.string()),
    authUserId: v.optional(v.string()),
    createdAt: v.number(),
    email: v.string(),
    emailNormalized: v.optional(v.string()),
    image: v.optional(v.string()),
    legacyUserId: v.optional(v.string()),
    mergeConflictFields: v.optional(v.array(v.string())),
    mergedIntoProfileId: v.optional(v.id("userProfiles")),
    name: v.string(),
    passportDetailsEncrypted: v.optional(v.string()),
    phoneNumber: v.optional(v.string()),
    sacredBharatLeaderboardOptOut: v.optional(v.boolean()),
    updatedAt: v.number(),
  })
    .index("by_authUserId", ["authUserId"])
    .index("by_email", ["email"])
    .index("by_emailNormalized", ["emailNormalized"]),

  vendors: defineTable({
    contact: v.optional(v.string()),
    contractStatus: v.optional(v.string()),
    createdAt: v.number(),
    createdBy: v.string(),
    escalationMatrix: v.optional(v.string()),
    jobCardId: v.optional(v.id("jobCards")),
    name: v.string(),
    notes: v.optional(v.string()),
    paymentStatus: v.optional(v.string()),
    type: v.string(),
    updatedAt: v.number(),
  }).index("by_jobCardId", ["jobCardId"]),

  visaRecords: defineTable({
    appointmentDate: v.optional(v.string()),
    approvedAt: v.optional(v.number()),
    checklistSharedAt: v.optional(v.number()),
    createdAt: v.number(),
    jobCardId: v.id("jobCards"),
    notes: v.optional(v.string()),
    rejectedAt: v.optional(v.number()),
    status: visaStatus,
    submittedAt: v.optional(v.number()),
    travellerId: v.id("travellers"),
    updatedAt: v.number(),
    updatedBy: v.string(),
  })
    .index("by_travellerId", ["travellerId"])
    .index("by_jobCardId", ["jobCardId"])
    .index("by_status", ["status"])
    .index("by_createdAt", ["createdAt"]),
});
