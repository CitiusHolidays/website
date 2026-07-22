import { PORTAL_PERMISSIONS as P, TICKETING_SCOPE_OPTIONS } from "@/lib/portal/constants";
import { toNumber } from "@/lib/portal/formUtils";
import { validateModalForm } from "@/lib/portal/formValidation";
import { getExpenseSplitTotal } from "@/lib/portal/workflow";

function normalizedTicketingScope(scope) {
  const value = String(scope ?? "").trim();
  if (!value) {
    return;
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
  if (!jobCardModals?.has(modal)) {
    return false;
  }
  if (modal === "expense" && form.expenseType === "office") {
    return false;
  }
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
        batchingNotes: travelInBatches ? form.batchingNotes : "",
        budgetAmount: toNumber(form.budgetAmount, 0),
        clientName: form.clientName,
        contactMobile: form.contactMobile,
        contactPerson: form.contactPerson,
        destination: form.destination,
        notes: form.notes,
        paxCount: toNumber(form.paxCount, 1),
        queryId: form.entityId,
        queryType: form.queryType,
        salesOwnerName: form.salesOwnerName,
        source: form.source,
        travelEndDate: form.travelEndDate,
        travelInBatches,
        travelStartDate: form.travelStartDate,
        travelType: form.travelType,
      });
    } else {
      const created = await deps.createQuery({
        batchingNotes: travelInBatches ? form.batchingNotes : "",
        budgetAmount: toNumber(form.budgetAmount, 0),
        clientName: form.clientName,
        contactMobile: form.contactMobile,
        contactPerson: form.contactPerson,
        contractingStaffId: form.staffId || undefined,
        destination: form.destination,
        notes: form.notes,
        paxCount: toNumber(form.paxCount, 1),
        queryType: form.queryType,
        salesOwnerName: form.salesOwnerName,
        source: form.source,
        ticketingScope: normalizedTicketingScope(form.ticketingScope),
        travelEndDate: form.travelEndDate,
        travelInBatches,
        travelStartDate: form.travelStartDate,
        travelType: form.travelType,
      });
      if (deps.pendingQueryFiles.length > 0) {
        await deps.uploadQueryFiles({
          attachQueryFile: deps.attachQueryFile,
          files: deps.pendingQueryFiles,
          generateUploadUrl: deps.generateQueryUploadUrl,
          queryId: created.id,
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
      contractingStaffId: contractingStaffId || undefined,
      queryId: form.queryId,
      ticketingScope,
      ticketingStaffId: ticketingStaffId || undefined,
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
      leadStage:
        decision === "Order Confirmed"
          ? "Confirmation"
          : decision === "Order Lost"
            ? "Lost"
            : decision === "Date/Destination Change Required"
              ? "Negotiation"
              : "Proposal",
      lostReason: decision === "Order Lost" ? form.lostReason : undefined,
      queryId: form.queryId,
      salesStatus: decision,
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
    const proposalQueryIds =
      Array.isArray(form.queryIds) && form.queryIds.length > 0
        ? form.queryIds
        : form.queryId
          ? [form.queryId]
          : [];
    const proposalPayload = {
      airfarePerPax: toNumber(form.airfarePerPax, 0),
      clientName: form.clientName,
      landCostPerPax: toNumber(form.landCostPerPax, 0),
      queryIds: proposalQueryIds,
      sellingPrice: toNumber(form.sellingPrice, 0),
      visaCostPerPax: toNumber(form.visaCostPerPax, 0),
      ...(form.taxRate === ""
        ? form.entityId
          ? { taxRate: null }
          : {}
        : { taxRate: toNumber(form.taxRate, 0) }),
      itinerarySummary: form.itinerarySummary,
    };
    if (form.entityId) {
      await deps.updateProposal({ proposalId: form.entityId, ...proposalPayload });
    } else {
      await deps.createProposal(proposalPayload);
    }
  }
  if (modal === "travelBatch") {
    const travelBatchPayload = withoutUndefinedValues({
      confirmedPax: toNumber(form.confirmedPax, 1),
      contractingOwnerId: form.contractingOwnerId || undefined,
      contractingOwnerName: form.contractingOwnerName?.trim() || undefined,
      destination: form.destination,
      operationsOwnerId: form.operationsOwnerId || undefined,
      operationsOwnerName: form.operationsOwnerName?.trim() || undefined,
      roomCount: toNumber(form.roomCount, 0),
      status: form.status || undefined,
      ticketingOwnerId: form.ticketingOwnerId || undefined,
      ticketingOwnerName: form.ticketingOwnerName?.trim() || undefined,
      tourManagerName: form.tourManagerName?.trim() || undefined,
      travelEndDate: form.travelEndDate,
      travelStartDate: form.travelStartDate,
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
        clientName: form.clientName,
        confirmedPax: toNumber(form.confirmedPax, 1),
        destination: form.destination,
        jobCardId: form.entityId,
        roomCount: toNumber(form.roomCount, 0),
        travelEndDate: form.travelEndDate,
        travelStartDate: form.travelStartDate,
      });
    } else {
      await deps.createJobCard({
        clientName: form.clientName,
        confirmedPax: toNumber(form.confirmedPax, 1),
        destination: form.destination,
        proposalId: form.proposalId || undefined,
        queryId: form.queryId,
        roomCount: toNumber(form.roomCount, 0),
        travelEndDate: form.travelEndDate,
        travelStartDate: form.travelStartDate,
      });
    }
  }
  if (modal === "traveller") {
    const travellerPayload = {
      arrivingEarly: form.arrivingEarly === "Yes",
      biometricAppointmentDate: form.biometricAppointmentDate,
      domesticTravelRequired: form.domesticTravelRequired === "Yes",
      extensionOfTour: form.extensionOfTour === "Yes",
      foodPreference: form.foodPreference,
      fullName: form.fullName,
      gender: form.gender,
      givenName: form.givenName,
      guestCompanions: form.guestCompanions,
      guestType: form.guestType,
      hotelAllocation: form.hotelAllocation,
      passportStatus: form.passportStatus,
      paymentType: form.paymentType,
      roomType: form.roomType,
      specialRequests: form.notes,
      surname: form.surname,
      travelBatchId: form.travelBatchId || "",
      travelDate: form.travelDate,
      travelHub: form.travelHub,
      visaRequired: form.visaRequired === "Yes",
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
      appointmentDate: form.appointmentDate,
      notes: form.notes,
      status: form.visaStatus,
      visaRecordId: form.visaRecordId,
    });
  }
  if (modal === "visa_create") {
    await deps.createVisa({ status: form.visaStatus, travellerId: form.travellerId });
  }
  if (modal === "pnr") {
    if (form.entityId) {
      await deps.updatePnr({
        airline: form.airline,
        fareType: form.fareType,
        pnrCode: form.pnrCode,
        pnrId: form.entityId,
        route: form.route,
        totalSeats: toNumber(form.totalSeats, 1),
      });
    } else {
      await deps.createPnr({
        airline: form.airline,
        fareType: form.fareType,
        jobCardId: form.jobCardId,
        pnrCode: form.pnrCode,
        route: form.route,
        totalSeats: toNumber(form.totalSeats, 1),
      });
    }
  }
  if (modal === "ticket") {
    const ticketPayload = {
      cabinClass: form.cabinClass,
      mealPreference: form.foodPreference,
      paymentType: form.paymentType,
      pnrId: form.pnrId || undefined,
      seatNumber: form.seatNumber,
      seatPreference: form.seatPreference,
      ticketNumber: form.ticketNumber,
      ticketStatus: form.ticketStatus,
      ticketType: form.ticketType,
      travellerId: form.travellerId || undefined,
    };
    if (form.entityId) {
      await deps.updateTicket({ ticketId: form.entityId, ...ticketPayload });
    } else {
      await deps.createTicket({ jobCardId: form.jobCardId, ...ticketPayload });
    }
  }
  if (modal === "seat") {
    const payload = {
      notes: form.notes,
      pnrId: form.pnrId || undefined,
      seatNumber: form.seatNumber,
      status: form.seatStatus,
      travellerId: form.travellerId || undefined,
    };
    if (form.entityId) {
      await deps.updateSeatAllocation({ seatAllocationId: form.entityId, ...payload });
    } else {
      await deps.saveSeat({ jobCardId: form.jobCardId, ...payload });
    }
  }
  if (modal === "hotel") {
    const payload = {
      checkInDate: form.checkInDate,
      checkOutDate: form.checkOutDate,
      city: form.city,
      name: form.hotelName,
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
      availabilityDate: form.travelStartDate,
      email: form.staffEmail,
      jobCardId: form.jobCardId || undefined,
      name: selectedTm?.name || form.tourManagerName,
      notes: form.notes,
      phone: form.paidBy,
      reportingInstructions: form.reportingInstructions,
      travelBatchId: form.travelBatchId || "",
    };
    if (form.entityId) {
      await deps.updateTourManager({
        staffId: form.staffId || undefined,
        tourManagerId: form.entityId,
        ...payload,
      });
    } else {
      await deps.createTourManager({ staffId: form.staffId || undefined, ...payload });
    }
  }
  if (modal === "invoice") {
    const payload = {
      dueDate: form.dueDate,
      expectedAmount: toNumber(form.expectedAmount, 0),
      invoiceNumber: form.invoiceNumber,
      receivedAmount: toNumber(form.receivedAmount, 0),
    };
    if (form.entityId) {
      await deps.updateInvoice({ invoiceId: form.entityId, ...payload });
    } else {
      await deps.createInvoice({ jobCardId: form.jobCardId, ...payload });
    }
  }
  if (modal === "expense") {
    const expensePayload = {
      amount: getExpenseSplitTotal({
        cardAmount: form.cardAmount,
        cashAmount: form.cashAmount,
        epayAmount: form.epayAmount,
      }),
      cardAmount: toNumber(form.cardAmount, 0),
      cashAmount: toNumber(form.cashAmount, 0),
      category: form.category,
      currency: form.currency,
      epayAmount: toNumber(form.epayAmount, 0),
      expenseDate: form.expenseDate,
      notes: form.notes,
      paidBy: form.paidBy,
      particulars: form.particulars,
      tourManagerName: form.tourManagerName,
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
        attachExpenseProof: deps.attachExpenseProof,
        expenseId,
        files: deps.pendingExpenseProofFiles.slice(0, 1),
        generateUploadUrl: deps.generateExpenseUploadUrl,
      });
    }
  }
  if (modal === "staff") {
    const result = await deps.upsertStaff({
      active: Boolean(form.staffActive),
      confirmationDate: form.confirmationDate,
      department: form.department,
      email: form.staffEmail,
      emailAlertRoles: form.emailAlertRoles || [],
      employmentStatus: form.employmentStatus,
      function: form.staffFunction,
      joiningDate: form.joiningDate,
      leaveHeadApproverId: form.leaveHeadApproverId || undefined,
      leavePolicyGroup: form.leavePolicyGroup,
      location: form.location,
      marriageLeaveUsed: Boolean(form.marriageLeaveUsed),
      maternityEventsUsed: toNumber(form.maternityEventsUsed, 0),
      mobile: form.mobile,
      name: form.staffName,
      paternityEventsUsed: toNumber(form.paternityEventsUsed, 0),
      reportingManagerName: form.reportingManagerName || undefined,
      reportingManagerStaffId: form.reportingManagerStaffId || undefined,
      roles: form.staffRoles,
      staffId: form.staffId || undefined,
    });
    if (result?.created) {
      return `Staff added. A verification email was sent to ${form.staffEmail}. They must verify their email before receiving a password setup link.`;
    }
  }
  if (modal === "leave_create") {
    const leavePayload = {
      endDate: form.endDate,
      leaveType: form.leaveType,
      reason: form.reason,
      startDate: form.startDate,
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
      decisionNote: form.decisionNote,
      status: form.approvalStatus,
    });
  }
  return "Saved";
}
