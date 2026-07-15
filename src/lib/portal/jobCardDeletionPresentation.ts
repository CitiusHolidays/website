const JOB_CARD_DELETION_STAGE_LABELS: Record<string, string> = {
  additionalServices: "Additional services",
  checklistTasks: "Checklist tasks",
  complete: "Complete",
  eventFlows: "Event flows",
  expenseEntries: "Expenses",
  finishingDescendants: "Finishing cleanup",
  flightGroups: "Flight groups",
  flightSegments: "Flight segments",
  hotels: "Hotels",
  invoices: "Invoices",
  itineraries: "Itineraries",
  passportDetails: "Passport details",
  pnrs: "PNRs",
  roomingListEntries: "Rooming list",
  seatAllocations: "Seat allocations",
  tickets: "Tickets",
  tourManagerAssignments: "Tour managers",
  travelBatches: "Travel batches",
  travellers: "Travellers",
  vendors: "Vendors",
  visaRecords: "Visa records",
};

export function humanizeJobCardDeletionStage(stage: string) {
  if (JOB_CARD_DELETION_STAGE_LABELS[stage]) {
    return JOB_CARD_DELETION_STAGE_LABELS[stage];
  }
  const spaced = stage.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function formatJobCardDeletionCount(deletedCount: number) {
  const count = Math.max(0, deletedCount);
  return `${count} record${count === 1 ? "" : "s"} removed`;
}
