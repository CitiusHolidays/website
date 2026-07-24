"use client";

function jobCardSelectOptions(jobCards, { required = false, allowUnassigned = false } = {}) {
  const options = jobCards.map((job) => ({
    label: `${job.jobCode} - ${job.clientName}`,
    value: job.id,
  }));
  if (allowUnassigned) {
    return [{ label: "Unassigned", value: "" }, ...options];
  }
  if (required) {
    return [{ label: "Select job card…", value: "" }, ...options];
  }
  return options;
}

function linkedTravellerOptions(travellers, jobCardId) {
  const availableTravellers = travellers ?? [];
  const rows = jobCardId
    ? availableTravellers.filter((traveller) => traveller.jobCardId === jobCardId)
    : availableTravellers;
  return [
    { label: jobCardId ? "Unassigned" : "Select job card first…", value: "" },
    ...rows.map((traveller) => ({
      label: `${traveller.fullName} - ${traveller.jobCode}`,
      value: traveller.id,
    })),
  ];
}

function travelBatchLabel(batch) {
  return batch.batchReference || batch.batchCode || batch.id;
}

function travelBatchSelectOptions(jobCards, jobCardId) {
  const job = jobCards.find((entry) => entry.id === jobCardId);
  const batches = job?.travelBatches || [];
  return [
    { label: jobCardId ? "Unbatched" : "Select job card first…", value: "" },
    ...batches.map((batch) => ({
      label: travelBatchLabel(batch),
      value: batch.id,
    })),
  ];
}

function linkedPnrOptions(pnrs, jobCardId) {
  const availablePnrs = pnrs ?? [];
  const rows = jobCardId
    ? availablePnrs.filter((pnr) => pnr.jobCardId === jobCardId)
    : availablePnrs;
  return [
    { label: jobCardId ? "No PNR" : "Select job card first…", value: "" },
    ...rows.map((pnr) => ({
      label: `${pnr.pnrCode} - ${pnr.route}`,
      value: pnr.id,
    })),
  ];
}

function applyJobCardLink(form, job, modal, { onlyEmpty = false } = {}) {
  if (!job) {
    return {};
  }

  const patch = { jobCardId: job.id };
  const set = (field, value) => {
    if (value === undefined || value === null || value === "") {
      return;
    }
    if (onlyEmpty && form[field]) {
      return;
    }
    patch[field] = value;
  };

  if (modal === "traveller") {
    set("travelDate", job.travelStartDate);
    if (!(onlyEmpty && form.travelBatchId)) {
      patch.travelBatchId = "";
    }
  }
  if (modal === "hotel") {
    set("checkInDate", job.travelStartDate);
    set("checkOutDate", job.travelEndDate);
    set("city", job.destination);
  }
  if (modal === "expense" || modal === "tourManager") {
    set("tourManagerName", job.tourManagerName);
  }
  if (modal === "travelBatch") {
    set("destination", job.destination);
    set("confirmedPax", String(job.confirmedPax ?? ""));
    set("roomCount", String(job.roomCount ?? ""));
    set("travelStartDate", job.travelStartDate);
    set("travelEndDate", job.travelEndDate);
    set("contractingOwnerId", job.contractingOwnerId);
    set("contractingOwnerName", job.contractingOwnerName);
    set("operationsOwnerId", job.operationsOwnerId);
    set("operationsOwnerName", job.operationsOwnerName);
    set("ticketingOwnerId", job.ticketingOwnerId);
    set("ticketingOwnerName", job.ticketingOwnerName);
    set("tourManagerName", job.tourManagerName);
    set("status", job.status || "Open");
  }

  return patch;
}

function applyTravellerLink(form, traveller, modal, { onlyEmpty = false } = {}) {
  if (!traveller) {
    return { travellerId: "" };
  }

  const patch = { travellerId: traveller.id };
  const set = (field, value) => {
    if (value === undefined || value === null || value === "") {
      return;
    }
    if (onlyEmpty && form[field]) {
      return;
    }
    patch[field] = value;
  };

  if (traveller.jobCardId) {
    set("jobCardId", traveller.jobCardId);
  }
  if (modal === "traveller") {
    set("travelBatchId", traveller.travelBatchId || "");
  }
  if (modal === "ticket") {
    set("paymentType", traveller.paymentType);
    set("foodPreference", traveller.foodPreference);
  }

  return patch;
}

function applyPnrLink(form, pnr, modal, { onlyEmpty = false } = {}) {
  if (!pnr) {
    return { pnrId: "" };
  }

  const patch = { pnrId: pnr.id };
  if (pnr.jobCardId && !(onlyEmpty && form.jobCardId)) {
    patch.jobCardId = pnr.jobCardId;
  }
  return patch;
}

function applyQueryLink(form, query, { onlyEmpty = false } = {}) {
  if (!query?.id) {
    return {};
  }

  const patch = { queryId: query.id };
  const set = (field, value) => {
    if (value === undefined || value === null || value === "") {
      return;
    }
    if (onlyEmpty && form[field]) {
      return;
    }
    patch[field] = value;
  };

  set("clientName", query.clientName);
  set("destination", query.destination || "");
  set("confirmedPax", String(query.paxCount || 1));
  set("travelStartDate", query.travelStartDate || "");
  set("travelEndDate", query.travelEndDate || "");
  set("paxCount", String(query.paxCount || 1));
  set("budgetAmount", query.budgetAmount ? String(query.budgetAmount) : "");
  set("landCostPerPax", query.contractingLandCost == null ? "" : String(query.contractingLandCost));
  set(
    "airfarePerPax",
    query.contractingAirlinesCost == null ? "" : String(query.contractingAirlinesCost)
  );
  set("visaCostPerPax", query.contractingVisaCost == null ? "" : String(query.contractingVisaCost));
  if (query.confirmedOffer) {
    patch.confirmedPax = String(query.confirmedOffer.confirmedPax);
    patch.destination = query.confirmedOffer.destination;
    patch.travelStartDate = query.confirmedOffer.travelStartDate;
    patch.travelEndDate = query.confirmedOffer.travelEndDate;
    patch.landCostPerPax = String(query.confirmedOffer.landCostPerPax);
    patch.airfarePerPax = String(query.confirmedOffer.airfarePerPax);
    patch.visaCostPerPax = String(query.confirmedOffer.visaCostPerPax);
    patch.sellingPricePerPax = String(query.confirmedOffer.sellingPricePerPax);
    patch.profitPerPax = String(query.confirmedOffer.profitPerPax);
  }
  return patch;
}

function applyStaffLink(staffId, member, modal) {
  const patch = { staffId: staffId || "" };
  if (!member) {
    return patch;
  }
  if (modal === "tourManager") {
    patch.tourManagerName = member.name;
    patch.staffEmail = member.email || "";
    patch.paidBy = member.mobile || "";
  }
  return patch;
}

function applyVisaRecordLink(form, visa, { onlyEmpty = false } = {}) {
  if (!visa?.id) {
    return {};
  }

  const patch = { visaRecordId: visa.id };
  const set = (field, value) => {
    if (value === undefined || value === null || value === "") {
      return;
    }
    if (onlyEmpty && form[field]) {
      return;
    }
    patch[field] = value;
  };

  set("visaStatus", visa.status);
  set("appointmentDate", visa.appointmentDate || "");
  set("notes", visa.notes || "");
  return patch;
}

function reconcileTravelBatchSelection(form, jobCards) {
  if (!(form.travelBatchId && form.jobCardId)) {
    return {};
  }
  const job = jobCards.find((entry) => entry.id === form.jobCardId);
  const batches = job?.travelBatches || [];
  if (!batches.some((batch) => batch.id === form.travelBatchId)) {
    return { travelBatchId: "" };
  }
  return {};
}

function reconcileLinkedSelections(form, travellers, pnrs, jobCards) {
  const patch = {};

  if (form.travellerId) {
    const traveller = travellers.find((entry) => entry.id === form.travellerId);
    if (!traveller || (form.jobCardId && traveller.jobCardId !== form.jobCardId)) {
      patch.travellerId = "";
    }
  }

  if (form.pnrId) {
    const pnr = pnrs.find((entry) => entry.id === form.pnrId);
    if (!pnr || (form.jobCardId && pnr.jobCardId !== form.jobCardId)) {
      patch.pnrId = "";
    }
  }

  Object.assign(patch, reconcileTravelBatchSelection(form, jobCards));

  return patch;
}

export {
  applyJobCardLink,
  applyPnrLink,
  applyQueryLink,
  applyStaffLink,
  applyTravellerLink,
  applyVisaRecordLink,
  jobCardSelectOptions,
  linkedPnrOptions,
  linkedTravellerOptions,
  reconcileLinkedSelections,
  reconcileTravelBatchSelection,
  travelBatchSelectOptions,
};
