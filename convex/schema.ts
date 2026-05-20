import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const bookingStatus = v.union(
  v.literal("pending"),
  v.literal("confirmed"),
  v.literal("failed"),
  v.literal("cancelled"),
  v.literal("refunded"),
);

const staffRole = v.union(
  v.literal("Admin"),
  v.literal("Directors"),
  v.literal("Sales"),
  v.literal("Sales Head"),
  v.literal("Contracting"),
  v.literal("Contracting Head"),
  v.literal("Accounts"),
  v.literal("Operations"),
  v.literal("Operations Head"),
  v.literal("Ticketing"),
  v.literal("Head of Ticketing"),
  v.literal("Tour Manager"),
  v.literal("Finance"),
);

const queryType = v.union(
  v.literal("MICE"),
  v.literal("MICE Bidding"),
  v.literal("Cement"),
  v.literal("Cement Bidding"),
  v.literal("FIT"),
  v.literal("Family Group"),
  v.literal("B2B"),
  v.literal("Spiritual"),
);

const travelType = v.union(
  v.literal("Domestic Travel"),
  v.literal("International Travel"),
);

const salesStatus = v.union(
  v.literal("Proposal in discussion"),
  v.literal("Change in destination"),
  v.literal("Order Confirmed"),
  v.literal("Order Lost"),
);

const leadStage = v.union(
  v.literal("Inquiry"),
  v.literal("Proposal"),
  v.literal("Negotiation"),
  v.literal("Confirmation"),
  v.literal("Closed"),
);

const querySource = v.union(
  v.literal("Website"),
  v.literal("WhatsApp"),
  v.literal("Email"),
  v.literal("Client"),
  v.literal("Referral"),
);

const contractingStatus = v.union(
  v.literal("Query Received"),
  v.literal("Proposal in progress"),
  v.literal("Proposal sent"),
  v.literal("Change in destination"),
  v.literal("Order Confirmed"),
  v.literal("Order Lost"),
);

const lostReason = v.union(
  v.literal("Price"),
  v.literal("Competition"),
  v.literal("Not travelling"),
  v.literal("Other"),
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
  v.literal("Re-applied"),
);

const ticketStatus = v.union(
  v.literal("Pending Issue"),
  v.literal("Issued"),
  v.literal("Name Change Required"),
  v.literal("Reissue Required"),
  v.literal("Cancelled"),
  v.literal("Refund Pending"),
  v.literal("Refunded"),
);

const paymentType = v.union(
  v.literal("Company Paid"),
  v.literal("Self Paid"),
  v.literal("Upgraded Self Paid"),
);

const roomType = v.union(
  v.literal("SGL"),
  v.literal("Twin"),
  v.literal("DBL"),
  v.literal("Child with Bed"),
  v.literal("Family Room"),
);

const foodPreference = v.union(
  v.literal("Veg"),
  v.literal("Non-Veg"),
  v.literal("Jain"),
  v.literal("Vegan"),
);

const callingStatus = v.union(
  v.literal("Pending"),
  v.literal("Done"),
  v.literal("No response"),
);

const guestType = v.union(
  v.literal("Employee"),
  v.literal("Client"),
  v.literal("VIP"),
);

const expenseCurrency = v.union(
  v.literal("INR"),
  v.literal("USD"),
  v.literal("AED"),
  v.literal("EUR"),
  v.literal("THB"),
  v.literal("SGD"),
);

const approvalStatus = v.union(
  v.literal("Pending"),
  v.literal("Approved"),
  v.literal("Rejected"),
);

export default defineSchema({
  userProfiles: defineTable({
    authUserId: v.string(),
    email: v.string(),
    name: v.string(),
    phoneNumber: v.optional(v.string()),
    passportDetailsEncrypted: v.optional(v.string()),
    image: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    legacyUserId: v.optional(v.string()),
  })
    .index("by_authUserId", ["authUserId"])
    .index("by_email", ["email"]),

  trips: defineTable({
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    startDate: v.string(),
    endDate: v.string(),
    totalSeats: v.number(),
    availableSeats: v.number(),
    priceInr: v.number(),
    priceUsd: v.number(),
    difficulty: v.optional(v.string()),
    itinerary: v.optional(v.any()),
    inclusions: v.optional(v.any()),
    exclusions: v.optional(v.any()),
    coverImage: v.optional(v.string()),
    gallery: v.optional(v.any()),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
    legacyTripId: v.optional(v.string()),
  })
    .index("by_slug", ["slug"])
    .index("by_legacyTripId", ["legacyTripId"])
    .index("by_isActive_startDate", ["isActive", "startDate"]),

  bookings: defineTable({
    userId: v.string(),
    tripId: v.id("trips"),
    status: bookingStatus,
    razorpayOrderId: v.string(),
    razorpayPaymentId: v.string(),
    razorpaySignature: v.optional(v.string()),
    totalAmount: v.number(),
    currency: v.string(),
    travelers: v.number(),
    travelerDetails: v.optional(v.any()),
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    confirmedAt: v.optional(v.number()),
    legacyBookingId: v.optional(v.string()),
  })
    .index("by_userId_createdAt", ["userId", "createdAt"])
    .index("by_razorpayOrderId", ["razorpayOrderId"])
    .index("by_razorpayPaymentId", ["razorpayPaymentId"])
    .index("by_legacyBookingId", ["legacyBookingId"])
    .index("by_status_createdAt", ["status", "createdAt"])
    .index("by_tripId", ["tripId"]),

  offices: defineTable({
    name: v.string(),
    code: v.string(),
    city: v.optional(v.string()),
    active: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_code", ["code"]),

  staffUsers: defineTable({
    authUserId: v.optional(v.string()),
    email: v.string(),
    emailNormalized: v.string(),
    name: v.string(),
    roles: v.array(staffRole),
    officeId: v.optional(v.id("offices")),
    department: v.optional(v.string()),
    function: v.optional(v.string()),
    mobile: v.optional(v.string()),
    location: v.optional(v.string()),
    active: v.boolean(),
    invitedBy: v.optional(v.string()),
    lastSeenAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_emailNormalized", ["emailNormalized"])
    .index("by_active", ["active"])
    .index("by_authUserId", ["authUserId"]),

  roleDefinitions: defineTable({
    role: staffRole,
    permissions: v.array(v.string()),
    description: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_role", ["role"]),

  clients: defineTable({
    name: v.string(),
    contactPerson: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    corporateDetails: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_name", ["name"]),

  queries: defineTable({
    queryCode: v.string(),
    clientId: v.optional(v.id("clients")),
    clientName: v.string(),
    contactPerson: v.optional(v.string()),
    contactMobile: v.optional(v.string()),
    destination: v.optional(v.string()),
    paxCount: v.number(),
    travelStartDate: v.optional(v.string()),
    travelEndDate: v.optional(v.string()),
    queryType,
    travelType,
    salesStatus,
    leadStage: v.optional(leadStage),
    contractingStatus,
    budgetAmount: v.optional(v.number()),
    source: v.optional(querySource),
    lostReason: v.optional(lostReason),
    lostReasonOther: v.optional(v.string()),
    salesOwnerId: v.optional(v.string()),
    salesOwnerName: v.optional(v.string()),
    contractingOwnerId: v.optional(v.string()),
    contractingOwnerName: v.optional(v.string()),
    notes: v.optional(v.string()),
    confirmedAt: v.optional(v.number()),
    submittedToContractingAt: v.optional(v.number()),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_queryCode", ["queryCode"])
    .index("by_salesStatus", ["salesStatus"])
    .index("by_contractingStatus", ["contractingStatus"])
    .index("by_queryType_createdAt", ["queryType", "createdAt"]),

  proposals: defineTable({
    proposalCode: v.string(),
    queryId: v.optional(v.id("queries")),
    clientName: v.string(),
    preparedBy: v.string(),
    landCostPerPax: v.optional(v.number()),
    airfarePerPax: v.optional(v.number()),
    itinerarySummary: v.optional(v.string()),
    status: v.union(
      v.literal("Draft"),
      v.literal("Sent"),
      v.literal("Accepted"),
      v.literal("Rejected"),
    ),
    sentAt: v.optional(v.number()),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_queryId", ["queryId"])
    .index("by_status", ["status"]),

  contractingAssignments: defineTable({
    queryId: v.id("queries"),
    ownerId: v.optional(v.string()),
    ownerName: v.string(),
    status: contractingStatus,
    notes: v.optional(v.string()),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_queryId", ["queryId"])
    .index("by_ownerId", ["ownerId"]),

  jobCards: defineTable({
    jobCode: v.string(),
    queryId: v.optional(v.id("queries")),
    proposalId: v.optional(v.id("proposals")),
    clientName: v.string(),
    destination: v.optional(v.string()),
    confirmedPax: v.number(),
    roomCount: v.optional(v.number()),
    travelStartDate: v.optional(v.string()),
    travelEndDate: v.optional(v.string()),
    queryType: v.optional(queryType),
    paymentTerms: v.optional(v.any()),
    operationsOwnerId: v.optional(v.string()),
    operationsOwnerName: v.optional(v.string()),
    tourManagerId: v.optional(v.id("tourManagerAssignments")),
    tourManagerName: v.optional(v.string()),
    status: v.union(
      v.literal("Open"),
      v.literal("In Operations"),
      v.literal("Ready for Departure"),
      v.literal("On Tour"),
      v.literal("Closed"),
    ),
    preDepartureChecklist: v.optional(v.any()),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_jobCode", ["jobCode"])
    .index("by_queryId", ["queryId"])
    .index("by_status", ["status"]),

  travellers: defineTable({
    jobCardId: v.id("jobCards"),
    fullName: v.string(),
    travelHub: v.optional(v.string()),
    foodPreference,
    guestType,
    paymentType,
    roomType,
    visaRequired: v.boolean(),
    domesticTravelRequired: v.optional(v.boolean()),
    biometricAppointmentDate: v.optional(v.string()),
    travelDate: v.optional(v.string()),
    extensionOfTour: v.optional(v.boolean()),
    arrivingEarly: v.optional(v.boolean()),
    guestCompanions: v.optional(v.string()),
    specialRequests: v.optional(v.string()),
    passportStatus: v.optional(v.string()),
    ticketStatus,
    visaStatus,
    callingStatus,
    cancellation: v.optional(v.boolean()),
    lastMinuteDrop: v.optional(v.boolean()),
    hotelAllocation: v.optional(v.string()),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_jobCardId", ["jobCardId"])
    .index("by_visaStatus", ["visaStatus"])
    .index("by_ticketStatus", ["ticketStatus"]),

  passportDetails: defineTable({
    travellerId: v.id("travellers"),
    encryptedPayload: v.string(),
    lastFour: v.optional(v.string()),
    status: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
    fileName: v.optional(v.string()),
    mimeType: v.optional(v.string()),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_travellerId", ["travellerId"]),

  visaRecords: defineTable({
    travellerId: v.id("travellers"),
    jobCardId: v.id("jobCards"),
    status: visaStatus,
    checklistSharedAt: v.optional(v.number()),
    appointmentDate: v.optional(v.string()),
    submittedAt: v.optional(v.number()),
    approvedAt: v.optional(v.number()),
    rejectedAt: v.optional(v.number()),
    notes: v.optional(v.string()),
    updatedBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_travellerId", ["travellerId"])
    .index("by_jobCardId", ["jobCardId"])
    .index("by_status", ["status"]),

  flightGroups: defineTable({
    jobCardId: v.id("jobCards"),
    name: v.string(),
    route: v.string(),
    airline: v.string(),
    flightNumber: v.string(),
    departureDate: v.string(),
    arrivalDate: v.optional(v.string()),
    ticketingType: v.optional(v.string()),
    totalSeats: v.number(),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_jobCardId", ["jobCardId"]),

  pnrs: defineTable({
    jobCardId: v.id("jobCards"),
    flightGroupId: v.optional(v.id("flightGroups")),
    pnrCode: v.string(),
    airline: v.string(),
    route: v.string(),
    fareType: v.optional(v.string()),
    status: v.optional(v.string()),
    totalSeats: v.number(),
    issuedSeats: v.number(),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_jobCardId", ["jobCardId"])
    .index("by_pnrCode", ["pnrCode"]),

  tickets: defineTable({
    jobCardId: v.id("jobCards"),
    travellerId: v.optional(v.id("travellers")),
    pnrId: v.optional(v.id("pnrs")),
    ticketNumber: v.optional(v.string()),
    ticketType: v.optional(
      v.union(v.literal("FIT Ticket"), v.literal("Group Ticket")),
    ),
    ticketStatus,
    paymentType,
    cabinClass: v.optional(v.string()),
    mealPreference: v.optional(foodPreference),
    seatPreference: v.optional(v.string()),
    seatNumber: v.optional(v.string()),
    nameChangeStatus: v.optional(v.string()),
    reissueStatus: v.optional(v.string()),
    cancellationStatus: v.optional(v.string()),
    refundStatus: v.optional(v.string()),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_jobCardId", ["jobCardId"])
    .index("by_travellerId", ["travellerId"])
    .index("by_pnrId", ["pnrId"])
    .index("by_ticketStatus", ["ticketStatus"]),

  seatAllocations: defineTable({
    jobCardId: v.id("jobCards"),
    travellerId: v.optional(v.id("travellers")),
    pnrId: v.optional(v.id("pnrs")),
    flightGroupId: v.optional(v.id("flightGroups")),
    seatNumber: v.string(),
    status: v.union(
      v.literal("Available"),
      v.literal("Held"),
      v.literal("Assigned"),
      v.literal("Blocked"),
    ),
    notes: v.optional(v.string()),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_jobCardId", ["jobCardId"])
    .index("by_pnrId", ["pnrId"])
    .index("by_travellerId", ["travellerId"]),

  mealPreferences: defineTable({
    travellerId: v.id("travellers"),
    ticketId: v.optional(v.id("tickets")),
    foodPreference,
    flightMealCode: v.optional(v.string()),
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_travellerId", ["travellerId"]),

  travelHubs: defineTable({
    name: v.string(),
    code: v.optional(v.string()),
    active: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_name", ["name"]),

  hotels: defineTable({
    jobCardId: v.id("jobCards"),
    name: v.string(),
    city: v.optional(v.string()),
    checkInDate: v.optional(v.string()),
    checkOutDate: v.optional(v.string()),
    earlyCheckIn: v.optional(v.boolean()),
    lateCheckout: v.optional(v.boolean()),
    specialInstructions: v.optional(v.string()),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_jobCardId", ["jobCardId"]),

  roomingListEntries: defineTable({
    jobCardId: v.id("jobCards"),
    travellerId: v.optional(v.id("travellers")),
    hotelId: v.optional(v.id("hotels")),
    roomType,
    roomNumber: v.optional(v.string()),
    sharingWith: v.optional(v.string()),
    notes: v.optional(v.string()),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_jobCardId", ["jobCardId"])
    .index("by_travellerId", ["travellerId"]),

  tourManagerAssignments: defineTable({
    jobCardId: v.optional(v.id("jobCards")),
    name: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    status: v.union(v.literal("Available"), v.literal("Assigned"), v.literal("Inactive")),
    languages: v.optional(v.array(v.string())),
    callingStatus,
    availabilityDate: v.optional(v.string()),
    notes: v.optional(v.string()),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_jobCardId", ["jobCardId"])
    .index("by_status", ["status"]),

  vendors: defineTable({
    jobCardId: v.optional(v.id("jobCards")),
    type: v.string(),
    name: v.string(),
    contact: v.optional(v.string()),
    contractStatus: v.optional(v.string()),
    paymentStatus: v.optional(v.string()),
    escalationMatrix: v.optional(v.string()),
    notes: v.optional(v.string()),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_jobCardId", ["jobCardId"]),

  itineraries: defineTable({
    jobCardId: v.id("jobCards"),
    title: v.string(),
    version: v.number(),
    content: v.optional(v.string()),
    frozen: v.boolean(),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_jobCardId", ["jobCardId"]),

  eventFlows: defineTable({
    jobCardId: v.id("jobCards"),
    title: v.string(),
    schedule: v.optional(v.any()),
    specialRequirements: v.optional(v.string()),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_jobCardId", ["jobCardId"]),

  checklistTasks: defineTable({
    jobCardId: v.id("jobCards"),
    category: v.string(),
    title: v.string(),
    completed: v.boolean(),
    dueDate: v.optional(v.string()),
    ownerRole: v.optional(staffRole),
    completedAt: v.optional(v.number()),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_jobCardId", ["jobCardId"])
    .index("by_completed", ["completed"]),

  paymentTerms: defineTable({
    queryType,
    minAdvancePercent: v.number(),
    maxAdvancePercent: v.number(),
    label: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_queryType", ["queryType"]),

  invoices: defineTable({
    jobCardId: v.id("jobCards"),
    invoiceNumber: v.string(),
    expectedAmount: v.number(),
    receivedAmount: v.number(),
    balanceAmount: v.number(),
    status: v.union(
      v.literal("Draft"),
      v.literal("Generated"),
      v.literal("Part Paid"),
      v.literal("Paid"),
      v.literal("Overdue"),
    ),
    dueDate: v.optional(v.string()),
    generatedAt: v.optional(v.number()),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_jobCardId", ["jobCardId"])
    .index("by_status", ["status"]),

  additionalServices: defineTable({
    jobCardId: v.id("jobCards"),
    description: v.string(),
    amount: v.number(),
    approved: v.boolean(),
    notes: v.optional(v.string()),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_jobCardId", ["jobCardId"]),

  expenseEntries: defineTable({
    jobCardId: v.id("jobCards"),
    tourManagerName: v.optional(v.string()),
    category: v.string(),
    expenseDate: v.optional(v.string()),
    particulars: v.optional(v.string()),
    currency: v.optional(expenseCurrency),
    cardAmount: v.optional(v.number()),
    cashAmount: v.optional(v.number()),
    epayAmount: v.optional(v.number()),
    submittedForApprovalAt: v.optional(v.number()),
    amount: v.number(),
    paidBy: v.string(),
    proofAttachmentId: v.optional(v.id("attachments")),
    approvalStatus: v.union(
      v.literal("Pending"),
      v.literal("Approved"),
      v.literal("Rejected"),
    ),
    reimbursementStatus: v.union(
      v.literal("Not Submitted"),
      v.literal("Pending"),
      v.literal("Reimbursed"),
    ),
    notes: v.optional(v.string()),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_jobCardId", ["jobCardId"])
    .index("by_approvalStatus", ["approvalStatus"]),

  approvalRequests: defineTable({
    requestCode: v.string(),
    type: v.string(),
    entityType: v.string(),
    entityId: v.string(),
    requestedBy: v.string(),
    requestedByName: v.optional(v.string()),
    summary: v.string(),
    amount: v.optional(v.number()),
    status: approvalStatus,
    decidedBy: v.optional(v.string()),
    decidedByName: v.optional(v.string()),
    decidedAt: v.optional(v.number()),
    decisionNote: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_entity", ["entityType", "entityId"])
    .index("by_type_status", ["type", "status"]),

  attachments: defineTable({
    entityType: v.string(),
    entityId: v.string(),
    fileName: v.string(),
    storageId: v.optional(v.string()),
    mimeType: v.optional(v.string()),
    url: v.optional(v.string()),
    createdBy: v.string(),
    createdAt: v.number(),
  }).index("by_entity", ["entityType", "entityId"]),

  activityLogs: defineTable({
    entityType: v.string(),
    entityId: v.optional(v.string()),
    action: v.string(),
    message: v.string(),
    actorId: v.string(),
    actorName: v.string(),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
  })
    .index("by_entity", ["entityType", "entityId"])
    .index("by_createdAt", ["createdAt"]),

  notifications: defineTable({
    recipientUserId: v.optional(v.string()),
    recipientRole: v.optional(staffRole),
    title: v.string(),
    body: v.string(),
    entityType: v.optional(v.string()),
    entityId: v.optional(v.string()),
    readAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_recipientUserId", ["recipientUserId"])
    .index("by_recipientRole", ["recipientRole"])
    .index("by_createdAt", ["createdAt"]),

  dropdownOptions: defineTable({
    category: v.string(),
    label: v.string(),
    value: v.string(),
    active: v.boolean(),
    sortOrder: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_category", ["category"])
    .index("by_category_value", ["category", "value"]),

  staffLeaveRecords: defineTable({
    staffId: v.id("staffUsers"),
    startDate: v.string(),
    endDate: v.string(),
    reason: v.string(),
    status: v.string(), // "Pending", "Approved", "Rejected"
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_staffId", ["staffId"])
    .index("by_startDate", ["startDate"]),
});
