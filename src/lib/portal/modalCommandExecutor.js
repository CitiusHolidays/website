import { PORTAL_PERMISSIONS as P, TICKETING_SCOPE_OPTIONS } from "@/lib/portal/constants";
import { toNumber } from "@/lib/portal/formUtils";
import { validateModalForm } from "@/lib/portal/formValidation";
import { getExpenseSplitTotal } from "@/lib/portal/workflow";

function normalizedTicketingScope(scope) {
  const value = String(scope ?? "").trim();
  if (!value) {
    return undefined;
  }
  if (!TICKETING_SCOPE_OPTIONS.includes(value)) {
    throw new Error("Select a valid Ticketing Scope.");
  }
  return value;
}

function withoutUndefinedValues(payload) {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
}

function modalRequiresJobCard(modal, form, jobCardModals) {
  if (!jobCardModals?.has(modal)) return false;
  if (modal === "expense" && form.expenseType === "office") return false;
  return true;
}

export async function executeModalCommand({ modal, form, deps }) {
  validateModalForm(modal, form, deps);
  if (modalRequiresJobCard(modal, form, deps.jobCardModals) && !form.jobCardId?.trim()) {
    throw new Error("Please select a job card.");
  }
  if (modal === "query") {
    const travelInBatches = form.travelInBatches === "Yes" || form.travelInBatches === true;
    if (form.entityId) {
      await deps.updateQuery({
        queryId: form.entityId,
        clientName: form.clientName,
        contactPerson: form.contactPerson,
        contactMobile: form.contactMobile,
        destination: form.destination,
        paxCount: toNumber(form.paxCount, 1),
        travelStartDate: form.travelStartDate,
        travelEndDate: form.travelEndDate,
        queryType: form.queryType,
        travelType: form.travelType,
        budgetAmount: toNumber(form.budgetAmount, 0),
        source: form.source,
        salesOwnerName: form.salesOwnerName,
        travelInBatches,
        batchingNotes: travelInBatches ? form.batchingNotes : "",
        notes: form.notes,
      });
    } else {
      const created = await deps.createQuery({
        clientName: form.clientName,
        contactPerson: form.contactPerson,
        contactMobile: form.contactMobile,
        destination: form.destination,
        paxCount: toNumber(form.paxCount, 1),
        travelStartDate: form.travelStartDate,
        travelEndDate: form.travelEndDate,
        queryType: form.queryType,
        travelType: form.travelType,
        budgetAmount: toNumber(form.budgetAmount, 0),
        source: form.source,
        salesOwnerName: form.salesOwnerName,
        contractingStaffId: form.staffId || undefined,
        ticketingScope: normalizedTicketingScope(form.ticketingScope),
        travelInBatches,
        batchingNotes: travelInBatches ? form.batchingNotes : "",
        notes: form.notes,
      });
      if (deps.pendingQueryFiles.length > 0) {
        await deps.uploadQueryFiles({
          queryId: created.id,
          files: deps.pendingQueryFiles,
          generateUploadUrl: deps.generateQueryUploadUrl,
          attachQueryFile: deps.attachQueryFile,
        });
      }
    }
  }
  if (modal === "assignContracting") {
    await deps.assignContracting({ queryId: form.queryId, staffId: form.staffId });
  }
  if (modal === "assignQueryTicketing") {
    await deps.assignQueryTicketing({
      queryId: form.queryId,
      staffId: form.ticketingStaffId || form.staffId,
    });
  }
  if (modal === "assignQueryTeams") {
    const contractingStaffId = String(form.staffId ?? "").trim();
    const ticketingStaffId = String(form.ticketingStaffId ?? "").trim();
    const ticketingScope = normalizedTicketingScope(form.ticketingScope);
    await deps.assignQueryTeams({
      queryId: form.queryId,
      contractingStaffId: contractingStaffId || undefined,
      ticketingStaffId: ticketingStaffId || undefined,
      ticketingScope,
    });
  }
  if (modal === "assignJobCardCreator") {
    await deps.assignJobCardCreator({ queryId: form.queryId, staffId: form.staffId });
  }
  if (modal === "addProposalCollaborator") {
    await deps.addProposalCollaborator({
      proposalId: form.proposalId || form.entityId,
      staffId: form.staffId,
    });
  }
  if (modal === "removeProposalCollaborator") {
    await deps.removeProposalCollaborator({
      proposalId: form.proposalId || form.entityId,
      staffId: form.staffId,
    });
  }
  if (modal === "addJobCardCollaborator") {
    await deps.addJobCardCollaborator({
      jobCardId: form.jobCardId || form.entityId,
      staffId: form.staffId,
    });
  }
  if (modal === "removeJobCardCollaborator") {
    await deps.removeJobCardCollaborator({
      jobCardId: form.jobCardId || form.entityId,
      staffId: form.staffId,
    });
  }
  if (modal === "assignContractingOwner") {
    await deps.assignContractingOwner({ jobCardId: form.jobCardId, staffId: form.staffId });
  }
  if (modal === "assignOperationsOwner") {
    await deps.assignOperationsOwner({ jobCardId: form.jobCardId, staffId: form.staffId });
  }
  if (modal === "assignTicketingOwner") {
    await deps.assignTicketingOwner({ jobCardId: form.jobCardId, staffId: form.staffId });
  }
  if (modal === "queryStatus") {
    const payload = { queryId: form.queryId };
    if (deps.has(P.MANAGE_CONTRACTING)) {
      payload.contractingStatus = form.contractingStatus;
      payload.contractingLandCost = toNumber(form.contractingLandCost, 0);
      payload.contractingAirlinesCost = toNumber(form.contractingAirlinesCost, 0);
      payload.contractingVisaCost = toNumber(form.contractingVisaCost, 0);
    }
    await deps.updateQueryStatus(payload);
  }
  if (modal === "salesDecision") {
    const decision = form.salesDecision || form.salesStatus || "Proposal in discussion";
    const payload = {
      queryId: form.queryId,
      salesStatus: decision,
      leadStage:
        decision === "Order Confirmed"
          ? "Confirmation"
          : decision === "Order Lost"
            ? "Lost"
            : decision === "Date/Destination Change Required"
              ? "Negotiation"
              : "Proposal",
      lostReason: decision === "Order Lost" ? form.lostReason : undefined,
    };
    const queryRow = deps.queries.find((query) => query.id === form.queryId);
    const confirmingNow = decision === "Order Confirmed";
    const alreadyConfirmed =
      queryRow?.salesStatus === "Order Confirmed" ||
      queryRow?.contractingStatus === "Order Confirmed";
    if ((confirmingNow || alreadyConfirmed) && form.approxMargin !== "") {
      payload.approxMargin = toNumber(form.approxMargin, 0);
    }
    await deps.updateQueryStatus(payload);
  }
  if (modal === "proposal") {
    let proposalResult = null;
    const proposalQueryIds =
      Array.isArray(form.queryIds) && form.queryIds.length > 0
        ? form.queryIds
        : form.queryId
          ? [form.queryId]
          : [];
    const proposalPayload = {
      queryIds: proposalQueryIds,
      clientName: form.clientName,
      landCostPerPax: toNumber(form.landCostPerPax, 0),
      airfarePerPax: toNumber(form.airfarePerPax, 0),
      visaCostPerPax: toNumber(form.visaCostPerPax, 0),
      sellingPrice: toNumber(form.sellingPrice, 0),
      ...(form.taxRate !== ""
        ? { taxRate: toNumber(form.taxRate, 0) }
        : form.entityId
          ? { taxRate: null }
          : {}),
      itinerarySummary: form.itinerarySummary,
    };
    if (form.entityId) {
      proposalResult = await deps.updateProposal({ proposalId: form.entityId, ...proposalPayload });
    } else {
      proposalResult = await deps.createProposal(proposalPayload);
    }
    const proposalId = form.entityId || proposalResult?.id;
    if (proposalId && deps.pendingProposalFiles.length > 0) {
      await deps.uploadEntityFiles({
        entityId: proposalId,
        idField: "proposalId",
        files: deps.pendingProposalFiles,
        generateUploadUrl: deps.generateProposalUploadUrl,
        attachFile: deps.attachProposalFile,
      });
    }
  }
  if (modal === "travelBatch") {
    const travelBatchPayload = withoutUndefinedValues({
      destination: form.destination,
      confirmedPax: toNumber(form.confirmedPax, 1),
      roomCount: toNumber(form.roomCount, 0),
      travelStartDate: form.travelStartDate,
      travelEndDate: form.travelEndDate,
      contractingOwnerId: form.contractingOwnerId || undefined,
      contractingOwnerName: form.contractingOwnerName?.trim() || undefined,
      operationsOwnerId: form.operationsOwnerId || undefined,
      operationsOwnerName: form.operationsOwnerName?.trim() || undefined,
      ticketingOwnerId: form.ticketingOwnerId || undefined,
      ticketingOwnerName: form.ticketingOwnerName?.trim() || undefined,
      tourManagerName: form.tourManagerName?.trim() || undefined,
      status: form.status || undefined,
    });
    if (form.entityId) {
      await deps.updateTravelBatch({
        travelBatchId: form.entityId,
        ...travelBatchPayload,
      });
    } else {
      await deps.createTravelBatch({
        jobCardId: form.jobCardId,
        ...travelBatchPayload,
      });
    }
  }
  if (modal === "jobCard") {
    if (form.entityId) {
      await deps.updateJobCard({
        jobCardId: form.entityId,
        clientName: form.clientName,
        destination: form.destination,
        confirmedPax: toNumber(form.confirmedPax, 1),
        roomCount: toNumber(form.roomCount, 0),
        travelStartDate: form.travelStartDate,
        travelEndDate: form.travelEndDate,
        tourManagerName: form.tourManagerName,
      });
    } else {
      await deps.createJobCard({
        queryId: form.queryId,
        proposalId: form.proposalId || undefined,
        clientName: form.clientName,
        destination: form.destination,
        confirmedPax: toNumber(form.confirmedPax, 1),
        roomCount: toNumber(form.roomCount, 0),
        travelStartDate: form.travelStartDate,
        travelEndDate: form.travelEndDate,
        tourManagerName: form.tourManagerName,
      });
    }
  }
  if (modal === "traveller") {
    const travellerPayload = {
      fullName: form.fullName,
      surname: form.surname,
      givenName: form.givenName,
      travelHub: form.travelHub,
      foodPreference: form.foodPreference,
      guestType: form.guestType,
      paymentType: form.paymentType,
      roomType: form.roomType,
      visaRequired: form.visaRequired === "Yes",
      domesticTravelRequired: form.domesticTravelRequired === "Yes",
      biometricAppointmentDate: form.biometricAppointmentDate,
      travelDate: form.travelDate,
      guestCompanions: form.guestCompanions,
      extensionOfTour: form.extensionOfTour === "Yes",
      arrivingEarly: form.arrivingEarly === "Yes",
      passportStatus: form.passportStatus,
      hotelAllocation: form.hotelAllocation,
      gender: form.gender,
      specialRequests: form.notes,
      travelBatchId: form.travelBatchId || "",
    };
    if (form.entityId) {
      await deps.updateTraveller({ travellerId: form.entityId, ...travellerPayload });
    } else {
      await deps.createTraveller({
        jobCardId: form.jobCardId,
        ...travellerPayload,
      });
    }
  }
  if (modal === "visa") {
    await deps.updateVisaRecord({
      visaRecordId: form.visaRecordId,
      status: form.visaStatus,
      appointmentDate: form.appointmentDate,
      notes: form.notes,
    });
  }
  if (modal === "visa_create") {
    await deps.createVisa({ travellerId: form.travellerId, status: form.visaStatus });
  }
  if (modal === "pnr") {
    if (form.entityId) {
      await deps.updatePnr({
        pnrId: form.entityId,
        pnrCode: form.pnrCode,
        airline: form.airline,
        route: form.route,
        fareType: form.fareType,
        totalSeats: toNumber(form.totalSeats, 1),
      });
    } else {
      await deps.createPnr({
        jobCardId: form.jobCardId,
        pnrCode: form.pnrCode,
        airline: form.airline,
        route: form.route,
        fareType: form.fareType,
        totalSeats: toNumber(form.totalSeats, 1),
      });
    }
  }
  if (modal === "ticket") {
    const ticketPayload = {
      travellerId: form.travellerId || undefined,
      pnrId: form.pnrId || undefined,
      ticketNumber: form.ticketNumber,
      ticketType: form.ticketType,
      ticketStatus: form.ticketStatus,
      paymentType: form.paymentType,
      cabinClass: form.cabinClass,
      mealPreference: form.foodPreference,
      seatPreference: form.seatPreference,
      seatNumber: form.seatNumber,
    };
    if (form.entityId) {
      await deps.updateTicket({ ticketId: form.entityId, ...ticketPayload });
    } else {
      await deps.createTicket({ jobCardId: form.jobCardId, ...ticketPayload });
    }
  }
  if (modal === "seat") {
    const payload = {
      travellerId: form.travellerId || undefined,
      pnrId: form.pnrId || undefined,
      seatNumber: form.seatNumber,
      status: form.seatStatus,
      notes: form.notes,
    };
    if (form.entityId) {
      await deps.updateSeatAllocation({ seatAllocationId: form.entityId, ...payload });
    } else {
      await deps.saveSeat({ jobCardId: form.jobCardId, ...payload });
    }
  }
  if (modal === "hotel") {
    const payload = {
      name: form.hotelName,
      city: form.city,
      checkInDate: form.checkInDate,
      checkOutDate: form.checkOutDate,
      specialInstructions: form.notes,
    };
    if (form.entityId) {
      await deps.updateHotel({ hotelId: form.entityId, ...payload });
    } else {
      await deps.createHotel({ jobCardId: form.jobCardId, ...payload });
    }
  }
  if (modal === "tourManager") {
    const selectedTm = deps.team.find((member) => member.id === form.staffId);
    const payload = {
      jobCardId: form.jobCardId || undefined,
      travelBatchId: form.travelBatchId || "",
      name: selectedTm?.name || form.tourManagerName,
      email: form.staffEmail,
      phone: form.paidBy,
      availabilityDate: form.travelStartDate,
      reportingInstructions: form.reportingInstructions,
      notes: form.notes,
    };
    if (form.entityId) {
      await deps.updateTourManager({
        tourManagerId: form.entityId,
        staffId: form.staffId || undefined,
        ...payload,
      });
    } else {
      await deps.createTourManager({ staffId: form.staffId || undefined, ...payload });
    }
  }
  if (modal === "invoice") {
    const payload = {
      invoiceNumber: form.invoiceNumber,
      expectedAmount: toNumber(form.expectedAmount, 0),
      receivedAmount: toNumber(form.receivedAmount, 0),
      dueDate: form.dueDate,
    };
    if (form.entityId) {
      await deps.updateInvoice({ invoiceId: form.entityId, ...payload });
    } else {
      await deps.createInvoice({ jobCardId: form.jobCardId, ...payload });
    }
  }
  if (modal === "expense") {
    const expensePayload = {
      tourManagerName: form.tourManagerName,
      category: form.category,
      expenseDate: form.expenseDate,
      particulars: form.particulars,
      currency: form.currency,
      cardAmount: toNumber(form.cardAmount, 0),
      cashAmount: toNumber(form.cashAmount, 0),
      epayAmount: toNumber(form.epayAmount, 0),
      amount: getExpenseSplitTotal({
        cardAmount: form.cardAmount,
        cashAmount: form.cashAmount,
        epayAmount: form.epayAmount,
      }),
      paidBy: form.paidBy,
      notes: form.notes,
    };
    let expenseResult = null;
    if (form.entityId) {
      expenseResult = await deps.updateExpense({ expenseId: form.entityId, ...expensePayload });
    } else {
      expenseResult = await deps.createExpense({
        jobCardId: form.expenseType === "jobCard" ? form.jobCardId : undefined,
        ...expensePayload,
      });
    }
    const expenseId = form.entityId || expenseResult?.id;
    if (expenseId && deps.pendingExpenseProofFiles.length > 0) {
      await deps.uploadExpenseProofFiles({
        expenseId,
        files: deps.pendingExpenseProofFiles.slice(0, 1),
        generateUploadUrl: deps.generateExpenseUploadUrl,
        attachExpenseProof: deps.attachExpenseProof,
      });
    }
  }
  if (modal === "staff") {
    const result = await deps.upsertStaff({
      staffId: form.staffId || undefined,
      email: form.staffEmail,
      name: form.staffName,
      roles: form.staffRoles,
      department: form.department,
      function: form.staffFunction,
      mobile: form.mobile,
      location: form.location,
      joiningDate: form.joiningDate,
      employmentStatus: form.employmentStatus,
      confirmationDate: form.confirmationDate,
      leavePolicyGroup: form.leavePolicyGroup,
      leaveHeadApproverId: form.leaveHeadApproverId || undefined,
      reportingManagerStaffId: form.reportingManagerStaffId || undefined,
      reportingManagerName: form.reportingManagerName || undefined,
      maternityEventsUsed: toNumber(form.maternityEventsUsed, 0),
      paternityEventsUsed: toNumber(form.paternityEventsUsed, 0),
      marriageLeaveUsed: Boolean(form.marriageLeaveUsed),
      active: Boolean(form.staffActive),
    });
    if (result?.created) {
      return `Staff added. A verification email was sent to ${form.staffEmail}. They must verify their email before receiving a password setup link.`;
    }
  }
  if (modal === "leave_create") {
    const leavePayload = {
      leaveType: form.leaveType,
      startDate: form.startDate,
      endDate: form.endDate,
      reason: form.reason,
    };
    if (form.entityId) {
      await deps.updateLeave({ leaveId: form.entityId, ...leavePayload });
    } else if (deps.has(P.MANAGE_LEAVE)) {
      await deps.createLeave({
        staffId: form.staffId,
        ...leavePayload,
        status: form.status || "Pending",
      });
    } else {
      await deps.createLeave(leavePayload);
    }
  }
  if (modal === "approvalDecide") {
    await deps.decideApproval({
      approvalId: form.approvalId,
      status: form.approvalStatus,
      decisionNote: form.decisionNote,
    });
  }
  return "Saved";
}
