import {
  getPortalRouteDataDependencies,
  type PortalDataDependency,
} from "@/lib/portal/portalRouteManifest";

export type { PortalDataDependency } from "@/lib/portal/portalRouteManifest";

const MODAL_DEPENDENCIES: Record<string, readonly PortalDataDependency[]> = {
  addJobCardCollaborator: ["jobCards", "team"],
  addProposalCollaborator: ["proposals", "team"],
  approval: ["approvals", "expenses"],
  assignContracting: ["queries", "team"],
  assignContractingOwner: ["jobCards", "team"],
  assignOperationsOwner: ["jobCards", "team"],
  assignQueryTeams: ["queries", "team"],
  assignQueryTicketing: ["queries", "team"],
  assignTicketingOwner: ["jobCards", "team"],
  expense: ["expenses", "jobCards"],
  flightExport: ["flightItinerary", "jobCards"],
  flightImport: ["flightItinerary", "jobCards"],
  hotel: ["hotels", "jobCards"],
  invoice: ["invoices", "jobCards"],
  jobCard: ["jobCards", "queries", "proposals"],
  leave_create: ["leaves", "team"],
  passengerExport: ["jobCards"],
  passengerImport: ["jobCards"],
  passportExport: ["jobCards"],
  passportImport: ["jobCards"],
  pnr: ["pnrs", "jobCards"],
  proposal: ["proposals", "queries"],
  query: ["queries", "team"],
  queryStatus: ["queries"],
  roomingExport: ["jobCards"],
  roomingImport: ["jobCards"],
  salesDecision: ["proposals", "queries"],
  seat: ["seats", "tickets", "pnrs", "travellers", "jobCards"],
  ticket: ["tickets", "pnrs", "travellers", "jobCards"],
  tourManager: ["tourManagers", "jobCards"],
  traveller: ["travellers", "jobCards"],
  travellerExport: ["jobCards"],
  travellerImport: ["jobCards"],
  visa: ["visas", "travellers", "jobCards"],
  visa_create: ["visas", "travellers", "jobCards", "travellersWithoutVisa"],
  visaExport: ["jobCards"],
  visaImport: ["jobCards"],
};

export function getPortalDataDependencies({
  deepLinkOpen,
  modal,
  view,
}: {
  deepLinkOpen?: string | null;
  modal?: string | null;
  view: string;
}): ReadonlySet<PortalDataDependency> {
  return new Set([
    ...getPortalRouteDataDependencies(view),
    ...(modal ? (MODAL_DEPENDENCIES[modal] ?? []) : []),
    ...(deepLinkOpen ? (MODAL_DEPENDENCIES[deepLinkOpen] ?? []) : []),
  ]);
}
