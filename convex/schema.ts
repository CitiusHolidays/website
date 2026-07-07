import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
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
  v.literal("Referral")
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

export default defineSchema({
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
  }).index("by_jobCardId", ["jobCardId"]),

  approvalRequests: defineTable({
    amount: v.optional(v.number()),
    createdAt: v.number(),
    decidedAt: v.optional(v.number()),
    decidedBy: v.optional(v.string()),
    decidedByName: v.optional(v.string()),
    decisionNote: v.optional(v.string()),
    entityId: v.string(),
    entityType: v.string(),
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
    .index("by_type_status", ["type", "status"]),

  attachments: defineTable({
    createdAt: v.number(),
    createdBy: v.string(),
    entityId: v.string(),
    entityType: v.string(),
    fileName: v.string(),
    mimeType: v.optional(v.string()),
    storageId: v.optional(v.string()),
    url: v.optional(v.string()),
  }).index("by_entity", ["entityType", "entityId"]),

  bookings: defineTable({
    confirmedAt: v.optional(v.number()),
    createdAt: v.number(),
    currency: v.string(),
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
    name: v.string(),
    phone: v.optional(v.string()),
    updatedAt: v.number(),
  }).index("by_name", ["name"]),

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
    managerApproverStaffId: v.optional(v.id("staffUsers")),
    managerReviewedAt: v.optional(v.number()),
    managerReviewedBy: v.optional(v.string()),
    managerReviewedByName: v.optional(v.string()),
    managerReviewStatus: v.optional(reviewStatus),
    notes: v.optional(v.string()),
    paidBy: v.string(),
    particulars: v.optional(v.string()),
    proofAttachmentId: v.optional(v.id("attachments")),
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
    .index("by_approvalStatus", ["approvalStatus"]),

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
    .index("by_jobCardId_importKey", ["jobCardId", "importKey"]),

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
  }).index("by_jobCardId", ["jobCardId"]),

  invoices: defineTable({
    balanceAmount: v.number(),
    createdAt: v.number(),
    createdBy: v.string(),
    dueDate: v.optional(v.string()),
    expectedAmount: v.number(),
    generatedAt: v.optional(v.number()),
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
    .index("by_status", ["status"]),

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

  jobCards: defineTable({
    clientName: v.string(),
    collaboratorStaffIds: v.optional(v.array(v.id("staffUsers"))),
    confirmedPax: v.number(),
    contractingOwnerId: v.optional(v.string()),
    contractingOwnerName: v.optional(v.string()),
    createdAt: v.number(),
    createdBy: v.string(),
    destination: v.optional(v.string()),
    jobCode: v.string(),
    lastEditedAt: v.optional(v.number()),
    lastEditedBy: v.optional(v.string()),
    lastEditedByName: v.optional(v.string()),
    operationsOwnerId: v.optional(v.string()),
    operationsOwnerName: v.optional(v.string()),
    paymentTerms: v.optional(v.any()),
    preDepartureChecklist: v.optional(v.any()),
    proposalId: v.optional(v.id("proposals")),
    queryId: v.optional(v.id("queries")),
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
    travelEndDate: v.optional(v.string()),
    travelStartDate: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_jobCode", ["jobCode"])
    .index("by_queryId", ["queryId"])
    .index("by_proposalId", ["proposalId"])
    .index("by_createdBy", ["createdBy"])
    .index("by_contractingOwnerId", ["contractingOwnerId"])
    .index("by_operationsOwnerId", ["operationsOwnerId"])
    .index("by_ticketingOwnerId", ["ticketingOwnerId"])
    .index("by_status", ["status"])
    .index("by_createdAt", ["createdAt"]),

  mealPreferences: defineTable({
    createdAt: v.number(),
    flightMealCode: v.optional(v.string()),
    foodPreference,
    notes: v.optional(v.string()),
    ticketId: v.optional(v.id("tickets")),
    travellerId: v.id("travellers"),
    updatedAt: v.number(),
  }).index("by_travellerId", ["travellerId"]),

  notifications: defineTable({
    body: v.string(),
    createdAt: v.number(),
    entityId: v.optional(v.string()),
    entityType: v.optional(v.string()),
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
    .index("by_createdAt", ["createdAt"])
    .index("by_recipientUserId_createdAt", ["recipientUserId", "createdAt"])
    .index("by_recipientRole_createdAt", ["recipientRole", "createdAt"]),

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
    .index("by_passportNumberHash", ["passportNumberHash"]),

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
    .index("by_pnrCode", ["pnrCode"]),

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
    proposalId: v.id("proposals"),
    storageId: v.id("_storage"),
  }).index("by_proposalId", ["proposalId"]),

  proposalQueryLinks: defineTable({
    createdAt: v.number(),
    createdBy: v.string(),
    proposalId: v.id("proposals"),
    queryId: v.id("queries"),
  })
    .index("by_proposalId", ["proposalId"])
    .index("by_queryId", ["queryId"])
    .index("by_proposalId_and_queryId", ["proposalId", "queryId"]),

  proposals: defineTable({
    airfarePerPax: v.optional(v.number()),
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
    preparedBy: v.string(),
    pricingEnteredAt: v.optional(v.number()),
    proposalCode: v.string(),
    queryId: v.optional(v.id("queries")),
    sellingPrice: v.optional(v.number()),
    sentAt: v.optional(v.number()),
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
    .index("by_createdAt", ["createdAt"]),

  queries: defineTable({
    approxMargin: v.optional(v.number()),
    batchingNotes: v.optional(v.string()),
    budgetAmount: v.optional(v.number()),
    clientId: v.optional(v.id("clients")),
    clientName: v.string(),
    confirmedAt: v.optional(v.number()),
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
    jobCardCreatorName: v.optional(v.string()),
    jobCardCreatorStaffId: v.optional(v.id("staffUsers")),
    leadStage: v.optional(leadStage),
    lostReason: v.optional(lostReason),
    lostReasonOther: v.optional(v.string()),
    notes: v.optional(v.string()),
    paxCount: v.number(),
    queryCode: v.string(),
    queryType,
    reassignToTeams: v.optional(v.boolean()),
    salesOwnerId: v.optional(v.string()),
    salesOwnerName: v.optional(v.string()),
    salesStatus,
    source: v.optional(querySource),
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
    .index("by_salesStatus", ["salesStatus"])
    .index("by_contractingStatus", ["contractingStatus"])
    .index("by_createdBy", ["createdBy"])
    .index("by_salesOwnerId", ["salesOwnerId"])
    .index("by_contractingOwnerId", ["contractingOwnerId"])
    .index("by_ticketingOwnerId", ["ticketingOwnerId"])
    .index("by_queryType_createdAt", ["queryType", "createdAt"])
    .index("by_createdAt", ["createdAt"]),

  queryAttachments: defineTable({
    createdAt: v.number(),
    createdBy: v.string(),
    fileName: v.string(),
    fileSize: v.number(),
    mimeType: v.string(),
    queryId: v.id("queries"),
    storageId: v.id("_storage"),
  }).index("by_queryId", ["queryId"]),

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

  sacredBharatGroups: defineTable({
    createdAt: v.number(),
    inviteCode: v.string(),
    isArchived: v.boolean(),
    name: v.string(),
    ownerAuthUserId: v.string(),
    updatedAt: v.number(),
  })
    .index("by_ownerAuthUserId", ["ownerAuthUserId"])
    .index("by_inviteCode", ["inviteCode"]),

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
    .index("by_travellerId", ["travellerId"]),

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
    .index("by_leaveRecordId", ["leaveRecordId"]),

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
    .index("by_startDate", ["startDate"]),

  staffUsers: defineTable({
    active: v.boolean(),
    authUserId: v.optional(v.string()),
    confirmationDate: v.optional(v.string()),
    createdAt: v.number(),
    department: v.optional(v.string()),
    email: v.string(),
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
    .index("by_authUserId", ["authUserId"]),

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
    .index("by_status", ["status"]),

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
    travelEndDate: v.optional(v.string()),
    travelStartDate: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_jobCardId", ["jobCardId"])
    .index("by_jobCardId_and_batchCode", ["jobCardId", "batchCode"])
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
    hotelAllocation: v.optional(v.string()),
    importKey: v.optional(v.string()),
    importSource: v.optional(v.string()),
    jobCardId: v.id("jobCards"),
    lastMinuteDrop: v.optional(v.boolean()),
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
    travelBatchId: v.optional(v.id("travelBatches")),
    travelDate: v.optional(v.string()),
    travelHub: v.optional(v.string()),
    updatedAt: v.number(),
    visaRequired: v.boolean(),
    visaStatus,
  })
    .index("by_jobCardId", ["jobCardId"])
    .index("by_travelBatchId", ["travelBatchId"])
    .index("by_jobCardId_and_travelBatchId", ["jobCardId", "travelBatchId"])
    .index("by_jobCardId_importKey", ["jobCardId", "importKey"])
    .index("by_visaStatus", ["visaStatus"])
    .index("by_ticketStatus", ["ticketStatus"]),

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
    authUserId: v.string(),
    createdAt: v.number(),
    email: v.string(),
    image: v.optional(v.string()),
    legacyUserId: v.optional(v.string()),
    name: v.string(),
    passportDetailsEncrypted: v.optional(v.string()),
    phoneNumber: v.optional(v.string()),
    sacredBharatLeaderboardOptOut: v.optional(v.boolean()),
    updatedAt: v.number(),
  })
    .index("by_authUserId", ["authUserId"])
    .index("by_email", ["email"]),

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
    .index("by_status", ["status"]),
});
