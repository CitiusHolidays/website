"use client";

function jobCardSelectOptions(jobCards, { required = false, allowUnassigned = false } = {}) {
  const options = jobCards.map((job) => ({
    value: job.id,
    label: `${job.jobCode} - ${job.clientName}`,
  }));
  if (allowUnassigned) {
    return [{ value: "", label: "Unassigned" }, ...options];
  }
  if (required) {
    return [{ value: "", label: "Select job card…" }, ...options];
  }
  return options;
}

function linkedTravellerOptions(travellers, jobCardId) {
  const rows = jobCardId
    ? travellers.filter((traveller) => traveller.jobCardId === jobCardId)
    : travellers;
  return [
    { value: "", label: jobCardId ? "Unassigned" : "Select job card first…" },
    ...rows.map((traveller) => ({
      value: traveller.id,
      label: `${traveller.fullName} - ${traveller.jobCode}`,
    })),
  ];
}

function linkedPnrOptions(pnrs, jobCardId) {
  const rows = jobCardId ? pnrs.filter((pnr) => pnr.jobCardId === jobCardId) : pnrs;
  return [
    { value: "", label: jobCardId ? "No PNR" : "Select job card first…" },
    ...rows.map((pnr) => ({
      value: pnr.id,
      label: `${pnr.pnrCode} - ${pnr.route}`,
    })),
  ];
}

function applyJobCardLink(form, job, modal, { onlyEmpty = false } = {}) {
  if (!job) return {};

  const patch = { jobCardId: job.id };
  const set = (field, value) => {
    if (value === undefined || value === null || value === "") return;
    if (onlyEmpty && form[field]) return;
    patch[field] = value;
  };

  if (modal === "traveller") {
    set("travelDate", job.travelStartDate);
  }
  if (modal === "hotel") {
    set("checkInDate", job.travelStartDate);
    set("checkOutDate", job.travelEndDate);
    set("city", job.destination);
  }
  if (modal === "expense" || modal === "tourManager") {
    set("tourManagerName", job.tourManagerName);
  }

  return patch;
}

function applyTravellerLink(form, traveller, modal, { onlyEmpty = false } = {}) {
  if (!traveller) return { travellerId: "" };

  const patch = { travellerId: traveller.id };
  const set = (field, value) => {
    if (value === undefined || value === null || value === "") return;
    if (onlyEmpty && form[field]) return;
    patch[field] = value;
  };

  if (traveller.jobCardId) {
    set("jobCardId", traveller.jobCardId);
  }
  if (modal === "ticket") {
    set("paymentType", traveller.paymentType);
    set("foodPreference", traveller.foodPreference);
  }

  return patch;
}

function applyPnrLink(form, pnr, modal, { onlyEmpty = false } = {}) {
  if (!pnr) return { pnrId: "" };

  const patch = { pnrId: pnr.id };
  if (pnr.jobCardId && (!onlyEmpty || !form.jobCardId)) {
    patch.jobCardId = pnr.jobCardId;
  }
  return patch;
}

function applyQueryLink(form, query, { onlyEmpty = false } = {}) {
  if (!query?.id) return {};

  const patch = { queryId: query.id };
  const set = (field, value) => {
    if (value === undefined || value === null || value === "") return;
    if (onlyEmpty && form[field]) return;
    patch[field] = value;
  };

  set("clientName", query.clientName);
  set("destination", query.destination || "");
  set("confirmedPax", String(query.paxCount || 1));
  set("travelStartDate", query.travelStartDate || "");
  set("travelEndDate", query.travelEndDate || "");
  set("paxCount", String(query.paxCount || 1));
  set("budgetAmount", query.budgetAmount ? String(query.budgetAmount) : "");
  set("landCostPerPax", query.contractingLandCost != null ? String(query.contractingLandCost) : "");
  set(
    "airfarePerPax",
    query.contractingAirlinesCost != null ? String(query.contractingAirlinesCost) : "",
  );
  set("visaCostPerPax", query.contractingVisaCost != null ? String(query.contractingVisaCost) : "");
  return patch;
}

function applyStaffLink(staffId, member, modal) {
  const patch = { staffId: staffId || "" };
  if (!member) return patch;
  if (modal === "tourManager") {
    patch.tourManagerName = member.name;
    patch.staffEmail = member.email || "";
    patch.paidBy = member.mobile || "";
  }
  return patch;
}

function applyVisaRecordLink(form, visa, { onlyEmpty = false } = {}) {
  if (!visa?.id) return {};

  const patch = { visaRecordId: visa.id };
  const set = (field, value) => {
    if (value === undefined || value === null || value === "") return;
    if (onlyEmpty && form[field]) return;
    patch[field] = value;
  };

  set("visaStatus", visa.status);
  set("appointmentDate", visa.appointmentDate || "");
  set("notes", visa.notes || "");
  return patch;
}

function reconcileLinkedSelections(form, travellers, pnrs) {
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
};
