import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { roomTypeValidator } from "./lib/roomTypeValidators";

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
  v.literal("Director Cement"),
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

const travelType = v.union(v.literal("Domestic Travel"), v.literal("International Travel"));

const salesStatus = v.union(
  v.literal("Proposal in discussion"),
  v.literal("Change in destination"),
  v.literal("Date/Destination Change Required"),
  v.literal("Order Confirmed"),
  v.literal("Order Lost"),
);

const leadStage = v.union(
  v.literal("Inquiry"),
  v.literal("Proposal"),
  v.literal("Negotiation"),
  v.literal("Confirmation"),
  v.literal("Lost"),
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
  v.literal("Date/Destination Change Required"),
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

const roomType = roomTypeValidator;

const foodPreference = v.union(
  v.literal("Veg"),
  v.literal("Non-Veg"),
  v.literal("Jain"),
  v.literal("Vegan"),
);

const callingStatus = v.union(v.literal("Pending"), v.literal("Done"), v.literal("No response"));

const guestType = v.union(v.literal("Employee"), v.literal("Client"), v.literal("VIP"));

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
  v.literal("Needs Info"),
);

const leaveType = v.union(
  v.literal("Privilege"),
  v.literal("Casual"),
  v.literal("Sick"),
  v.literal("Maternity"),
  v.literal("Paternity"),
  v.literal("Bereavement"),
  v.literal("Marriage"),
  v.literal("Leave Without Pay"),
);

const reviewStatus = v.union(v.literal("Pending"), v.literal("Approved"), v.literal("Rejected"));

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
    sacredBharatLeaderboardOptOut: v.optional(v.boolean()),
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
    joiningDate: v.optional(v.string()),
    employmentStatus: v.optional(v.union(v.literal("Probationer"), v.literal("Confirmed"))),
    confirmationDate: v.optional(v.string()),
    leavePolicyGroup: v.optional(v.string()),
    leaveHeadApproverId: v.optional(v.id("staffUsers")),
    reportingManagerName: v.optional(v.string()),
    reportingManagerStaffId: v.optional(v.id("staffUsers")),
    maternityEventsUsed: v.optional(v.number()),
    paternityEventsUsed: v.optional(v.number()),
    marriageLeaveUsed: v.optional(v.boolean()),
    jobCardCreatorEnabled: v.optional(v.boolean()),
    active: v.boolean(),
    invitedBy: v.optional(v.string()),
    pendingPasswordSetup: v.optional(v.boolean()),
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
    ticketingOwnerId: v.optional(v.string()),
    ticketingOwnerName: v.optional(v.string()),
    jobCardCreatorStaffId: v.optional(v.id("staffUsers")),
    jobCardCreatorName: v.optional(v.string()),
    notes: v.optional(v.string()),
    contractingLandCost: v.optional(v.number()),
    contractingAirlinesCost: v.optional(v.number()),
    contractingVisaCost: v.optional(v.number()),
    approxMargin: v.optional(v.number()),
    confirmedAt: v.optional(v.number()),
    submittedToContractingAt: v.optional(v.number()),
    createdBy: v.string(),
    createdAt: v.number(),
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
    queryId: v.id("queries"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    mimeType: v.string(),
    fileSize: v.number(),
    createdBy: v.string(),
    createdAt: v.number(),
  }).index("by_queryId", ["queryId"]),

  proposals: defineTable({
    proposalCode: v.string(),
    queryId: v.optional(v.id("queries")),
    clientName: v.string(),
    preparedBy: v.string(),
    landCostPerPax: v.optional(v.number()),
    airfarePerPax: v.optional(v.number()),
    visaCostPerPax: v.optional(v.number()),
    sellingPrice: v.optional(v.number()),
    costPrice: v.optional(v.number()),
    pricingEnteredAt: v.optional(v.number()),
    taxRate: v.optional(v.number()),
    itinerarySummary: v.optional(v.string()),
    status: v.union(
      v.literal("Draft"),
      v.literal("Sent"),
      v.literal("Accepted"),
      v.literal("Rejected"),
    ),
    sentAt: v.optional(v.number()),
    finalizedPdfStorageId: v.optional(v.id("_storage")),
    finalizedPdfFileName: v.optional(v.string()),
    finalizedPdfUploadedAt: v.optional(v.number()),
    finalizedPdfUploadedBy: v.optional(v.string()),
    collaboratorStaffIds: v.optional(v.array(v.id("staffUsers"))),
    lastEditedBy: v.optional(v.string()),
    lastEditedByName: v.optional(v.string()),
    lastEditedAt: v.optional(v.number()),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_queryId", ["queryId"])
    .index("by_createdBy", ["createdBy"])
    .index("by_status", ["status"])
    .index("by_createdAt", ["createdAt"]),

  proposalQueryLinks: defineTable({
    proposalId: v.id("proposals"),
    queryId: v.id("queries"),
    createdBy: v.string(),
    createdAt: v.number(),
  })
    .index("by_proposalId", ["proposalId"])
    .index("by_queryId", ["queryId"])
    .index("by_proposalId_and_queryId", ["proposalId", "queryId"]),

  proposalAttachments: defineTable({
    proposalId: v.id("proposals"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    mimeType: v.string(),
    fileSize: v.number(),
    createdBy: v.string(),
    createdAt: v.number(),
  }).index("by_proposalId", ["proposalId"]),

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
    contractingOwnerId: v.optional(v.string()),
    contractingOwnerName: v.optional(v.string()),
    operationsOwnerId: v.optional(v.string()),
    operationsOwnerName: v.optional(v.string()),
    ticketingOwnerId: v.optional(v.string()),
    ticketingOwnerName: v.optional(v.string()),
    collaboratorStaffIds: v.optional(v.array(v.id("staffUsers"))),
    lastEditedBy: v.optional(v.string()),
    lastEditedByName: v.optional(v.string()),
    lastEditedAt: v.optional(v.number()),
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
    .index("by_proposalId", ["proposalId"])
    .index("by_createdBy", ["createdBy"])
    .index("by_contractingOwnerId", ["contractingOwnerId"])
    .index("by_operationsOwnerId", ["operationsOwnerId"])
    .index("by_ticketingOwnerId", ["ticketingOwnerId"])
    .index("by_status", ["status"])
    .index("by_createdAt", ["createdAt"]),

  travellers: defineTable({
    jobCardId: v.id("jobCards"),
    fullName: v.string(),
    surname: v.optional(v.string()),
    givenName: v.optional(v.string()),
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
    gender: v.optional(v.string()),
    contactNo: v.optional(v.string()),
    importSource: v.optional(v.string()),
    importKey: v.optional(v.string()),
    sourceSheet: v.optional(v.string()),
    sourceRowNumber: v.optional(v.number()),
    sourceDealerCode: v.optional(v.string()),
    sourceDealerName: v.optional(v.string()),
    sourceDescription: v.optional(v.string()),
    sourceSoName: v.optional(v.string()),
    sourceRsoName: v.optional(v.string()),
    sourceGroup: v.optional(v.string()),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_jobCardId", ["jobCardId"])
    .index("by_jobCardId_importKey", ["jobCardId", "importKey"])
    .index("by_visaStatus", ["visaStatus"])
    .index("by_ticketStatus", ["ticketStatus"]),

  passportDetails: defineTable({
    travellerId: v.id("travellers"),
    encryptedPayload: v.string(),
    expiryDate: v.optional(v.string()),
    lastFour: v.optional(v.string()),
    status: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
    fileName: v.optional(v.string()),
    mimeType: v.optional(v.string()),
    passportNumberHash: v.optional(v.string()),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_travellerId", ["travellerId"])
    .index("by_passportNumberHash", ["passportNumberHash"]),

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
    importKey: v.optional(v.string()),
    sourceSheet: v.optional(v.string()),
    sourceGroupIndex: v.optional(v.number()),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_jobCardId", ["jobCardId"])
    .index("by_jobCardId_importKey", ["jobCardId", "importKey"]),

  flightSegments: defineTable({
    jobCardId: v.id("jobCards"),
    flightGroupId: v.id("flightGroups"),
    importKey: v.string(),
    sourceSheet: v.string(),
    sourceRowNumber: v.optional(v.number()),
    sourceGroupIndex: v.number(),
    segmentIndex: v.number(),
    dateLabel: v.string(),
    airline: v.string(),
    flightNumber: v.string(),
    departTime: v.optional(v.string()),
    origin: v.string(),
    arriveTime: v.optional(v.string()),
    destination: v.string(),
    duration: v.optional(v.string()),
    transit: v.optional(v.string()),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_jobCardId", ["jobCardId"])
    .index("by_flightGroupId", ["flightGroupId"])
    .index("by_jobCardId_importKey", ["jobCardId", "importKey"]),

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
    ticketType: v.optional(v.union(v.literal("FIT Ticket"), v.literal("Group Ticket"))),
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
    .index("by_ticketStatus", ["ticketStatus"])
    .index("by_createdAt", ["createdAt"]),

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
    jobCardId: v.optional(v.id("jobCards")),
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
    approvalStatus,
    managerReviewStatus: v.optional(reviewStatus),
    managerApproverStaffId: v.optional(v.id("staffUsers")),
    managerReviewedBy: v.optional(v.string()),
    managerReviewedByName: v.optional(v.string()),
    managerReviewedAt: v.optional(v.number()),
    financeReviewStatus: v.optional(reviewStatus),
    financeReviewedBy: v.optional(v.string()),
    financeReviewedByName: v.optional(v.string()),
    financeReviewedAt: v.optional(v.number()),
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
    .index("by_createdAt", ["createdAt"])
    .index("by_recipientUserId_createdAt", ["recipientUserId", "createdAt"])
    .index("by_recipientRole_createdAt", ["recipientRole", "createdAt"]),

  portalSavedViews: defineTable({
    ownerAuthUserId: v.optional(v.string()),
    ownerStaffId: v.optional(v.id("staffUsers")),
    sharedRole: v.optional(staffRole),
    name: v.string(),
    view: v.string(),
    pathname: v.string(),
    filterState: v.any(),
    isFavorite: v.boolean(),
    isPinnedToDashboard: v.boolean(),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_ownerAuthUserId", ["ownerAuthUserId"])
    .index("by_sharedRole", ["sharedRole"])
    .index("by_view", ["view"])
    .index("by_createdBy", ["createdBy"]),

  portalWorkflowRules: defineTable({
    key: v.string(),
    enabled: v.boolean(),
    thresholdHours: v.optional(v.number()),
    recipientRole: v.optional(staffRole),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),

  portalWorkflowRuleRuns: defineTable({
    ruleKey: v.string(),
    entityType: v.string(),
    entityId: v.string(),
    lastTriggeredAt: v.number(),
  })
    .index("by_ruleKey", ["ruleKey"])
    .index("by_entity", ["entityType", "entityId"])
    .index("by_rule_entity", ["ruleKey", "entityType", "entityId"]),

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
    leaveType: v.optional(leaveType),
    startDate: v.string(),
    endDate: v.string(),
    reason: v.string(),
    status: reviewStatus,
    headReviewStatus: v.optional(reviewStatus),
    headApproverStaffId: v.optional(v.id("staffUsers")),
    headApproverName: v.optional(v.string()),
    headReviewerRole: v.optional(staffRole),
    headReviewedBy: v.optional(v.string()),
    headReviewedByName: v.optional(v.string()),
    headReviewedAt: v.optional(v.number()),
    headDecisionNote: v.optional(v.string()),
    hrReviewStatus: v.optional(reviewStatus),
    hrReviewedBy: v.optional(v.string()),
    hrReviewedByName: v.optional(v.string()),
    hrReviewedAt: v.optional(v.number()),
    decisionNote: v.optional(v.string()),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_staffId", ["staffId"])
    .index("by_status", ["status"])
    .index("by_headReviewStatus", ["headReviewStatus"])
    .index("by_hrReviewStatus", ["hrReviewStatus"])
    .index("by_startDate", ["startDate"]),

  staffLeaveLedger: defineTable({
    staffId: v.id("staffUsers"),
    leaveRecordId: v.optional(v.id("staffLeaveRecords")),
    fiscalYear: v.string(),
    leaveType,
    entryType: v.union(
      v.literal("opening"),
      v.literal("accrual"),
      v.literal("usage"),
      v.literal("reversal"),
      v.literal("lapse"),
      v.literal("carry_forward"),
      v.literal("encashment"),
    ),
    days: v.number(),
    note: v.optional(v.string()),
    createdBy: v.string(),
    createdAt: v.number(),
  })
    .index("by_staffId", ["staffId"])
    .index("by_staffId_and_fiscalYear", ["staffId", "fiscalYear"])
    .index("by_staffId_and_fiscalYear_and_leaveType", ["staffId", "fiscalYear", "leaveType"])
    .index("by_leaveRecordId", ["leaveRecordId"]),

  staffLeaveBalances: defineTable({
    staffId: v.id("staffUsers"),
    fiscalYear: v.string(),
    leaveType,
    openingDays: v.number(),
    accruedDays: v.number(),
    usedDays: v.number(),
    carriedForwardDays: v.number(),
    encashableDays: v.number(),
    availableDays: v.number(),
    updatedAt: v.number(),
  })
    .index("by_staffId", ["staffId"])
    .index("by_staffId_and_fiscalYear", ["staffId", "fiscalYear"])
    .index("by_staffId_and_fiscalYear_and_leaveType", ["staffId", "fiscalYear", "leaveType"]),

  sacredBharatVisits: defineTable({
    authUserId: v.string(),
    templeId: v.string(),
    visitedAt: v.number(),
    visitedOn: v.optional(v.string()),
    note: v.optional(v.string()),
    source: v.optional(v.union(v.literal("self"), v.literal("citius_booking"))),
    citiusBookingId: v.optional(v.id("bookings")),
  })
    .index("by_authUserId", ["authUserId"])
    .index("by_authUserId_templeId", ["authUserId", "templeId"]),

  sacredBharatProfiles: defineTable({
    authUserId: v.string(),
    slug: v.string(),
    displayName: v.string(),
    bio: v.optional(v.string()),
    homeCity: v.optional(v.string()),
    isPublic: v.boolean(),
    shareWishlist: v.boolean(),
    shareRecentVisits: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_authUserId", ["authUserId"])
    .index("by_slug", ["slug"])
    .index("by_isPublic", ["isPublic"]),

  sacredBharatWishlist: defineTable({
    authUserId: v.string(),
    itemType: v.union(v.literal("temple"), v.literal("trail")),
    itemId: v.string(),
    createdAt: v.number(),
  })
    .index("by_authUserId", ["authUserId"])
    .index("by_authUserId_item", ["authUserId", "itemType", "itemId"]),

  sacredBharatGroups: defineTable({
    name: v.string(),
    ownerAuthUserId: v.string(),
    inviteCode: v.string(),
    isArchived: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_ownerAuthUserId", ["ownerAuthUserId"])
    .index("by_inviteCode", ["inviteCode"]),

  sacredBharatGroupMembers: defineTable({
    groupId: v.id("sacredBharatGroups"),
    authUserId: v.string(),
    role: v.union(v.literal("owner"), v.literal("member")),
    joinedAt: v.number(),
  })
    .index("by_groupId", ["groupId"])
    .index("by_authUserId", ["authUserId"])
    .index("by_groupId_authUserId", ["groupId", "authUserId"]),
});
