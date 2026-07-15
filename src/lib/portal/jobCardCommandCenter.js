import { formatDisplayDate } from "../formatDate";

const SECTION_SPECS = [
  ["travellers", "Traveller master"],
  ["passports", "Passports"],
  ["visas", "Visas"],
  ["tickets", "Tickets"],
  ["hotels", "Hotels/rooming"],
  ["tourManager", "Tour manager"],
  ["finance", "Finance/payment"],
  ["checklist", "Checklist tasks"],
];

function pct(done, total) {
  return total > 0 ? Math.round((done / total) * 100) : 0;
}

function section(key, label, done, total) {
  return {
    complete: total > 0 && done >= total,
    done,
    key,
    label,
    percent: pct(done, total),
    total,
  };
}

export function buildJobCardCommandCenter(payload = {}) {
  const travellers = payload.travellers ?? [];
  const tickets = payload.tickets ?? [];
  const visas = payload.visaRecords ?? [];
  const hotels = payload.hotels ?? [];
  const rooming = payload.rooming ?? [];
  const invoices = payload.invoices ?? [];
  const tasks = payload.checklistTasks ?? [];
  const job = payload.jobCard ?? {};
  const travellerTotal = Math.max(travellers.length, job.confirmedPax ?? 0);
  const readinessSections = [
    section("travellers", "Traveller master", travellers.length, travellerTotal),
    section(
      "passports",
      "Passports",
      travellers.filter((row) => row.passportStatus === "Received").length,
      travellerTotal
    ),
    section(
      "visas",
      "Visas",
      visas.filter((row) => ["Approved", "Not Required"].includes(row.status)).length,
      Math.max(visas.length, travellerTotal)
    ),
    section(
      "tickets",
      "Tickets",
      tickets.filter((row) => row.ticketStatus === "Issued").length,
      Math.max(tickets.length, travellerTotal)
    ),
    section("hotels", "Hotels/rooming", rooming.length || hotels.length, travellerTotal),
    section("tourManager", "Tour manager", job.tourManagerName ? 1 : 0, 1),
    section(
      "finance",
      "Finance/payment",
      invoices.filter((row) => (row.balanceAmount ?? 0) <= 0).length,
      invoices.length
    ),
    section(
      "checklist",
      "Checklist tasks",
      tasks.filter((row) => row.completed).length,
      tasks.length
    ),
  ];
  const blockers = readinessSections.flatMap((item) =>
    item.percent >= 100
      ? []
      : [
          {
            key: item.key,
            label: `${item.label} incomplete`,
            severity: item.percent < 50 ? "critical" : "warning",
          },
        ]
  );
  const ownerLanes = [
    { label: "Contracting SPOC", value: job.contractingOwnerName || "Unassigned" },
    { label: "Operations SPOC", value: job.operationsOwnerName || "Unassigned" },
    { label: "Ticketing SPOC", value: job.ticketingOwnerName || "Unassigned" },
    { label: "Tour Manager", value: job.tourManagerName || "Unassigned" },
    { label: "Finance", value: invoices.length ? `${invoices.length} invoice(s)` : "No invoices" },
  ];
  const nextActions = [
    ...blockers.map((blocker) => ({
      dueDate: job.travelStartDate ? formatDisplayDate(job.travelStartDate) : "",
      id: `blocker:${blocker.key}`,
      label: blocker.label,
      severity: blocker.severity,
    })),
    ...tasks.flatMap((task) =>
      task.completed
        ? []
        : [
            {
              dueDate: task.dueDate ? formatDisplayDate(task.dueDate) : "",
              id: task._id,
              label: task.title,
              severity: task.dueDate ? "warning" : "info",
            },
          ]
    ),
  ];
  return { blockers, nextActions, ownerLanes, readinessSections, sectionLabels: SECTION_SPECS };
}
