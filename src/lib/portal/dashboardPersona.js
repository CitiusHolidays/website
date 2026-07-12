import { PORTAL_PERMISSIONS as P } from "./constants";

/** @typedef {'sales' | 'contracting' | 'operations' | 'ticketing' | 'finance' | 'director' | 'hr'} DashboardPersonaId */

/** @typedef {'hero' | 'stats' | 'inbox' | 'pipeline' | 'workQueue' | 'readiness' | 'ticketingQueue' | 'queryTypes' | 'activity' | 'collapsible' | 'quickActions' | 'periodPresets'} DashboardSectionId */

/**
 * @param {(permission: string) => boolean} has
 * @param {{ permissions?: string[] }} [access]
 */
export function resolveDashboardPersona(has, access = {}) {
  const permissions = access.permissions || [];
  const deptViews = [
    has(P.VIEW_QUERIES),
    has(P.VIEW_CONTRACTING),
    has(P.VIEW_JOB_CARDS),
    has(P.VIEW_TICKETING),
    has(P.VIEW_FINANCE),
  ].filter(Boolean).length;
  const hasDirectorScope = has(P.VIEW_REPORTS) && deptViews >= 3;

  if (hasDirectorScope) {
    return persona("director", "Active queries", "active", [
      "hero",
      "quickActions",
      "periodPresets",
      "stats",
      "inbox",
      "pipeline",
      "workQueue",
      "ticketingQueue",
      "readiness",
      "queryTypes",
      "activity",
      "collapsible",
    ]);
  }

  if (
    has(P.MANAGE_LEAVE) &&
    has(P.VIEW_APPROVALS) &&
    !has(P.VIEW_QUERIES) &&
    !has(P.VIEW_JOB_CARDS)
  ) {
    return persona("hr", "Pending Approvals", "active", [
      "hero",
      "quickActions",
      "periodPresets",
      "stats",
      "inbox",
      "activity",
    ]);
  }

  if (has(P.MANAGE_CONTRACTING) && has(P.VIEW_CONTRACTING)) {
    return persona("contracting", "Proposals Sent", "active", [
      "hero",
      "quickActions",
      "periodPresets",
      "stats",
      "inbox",
      "pipeline",
      "activity",
    ]);
  }

  if (has(P.MANAGE_TICKETING) && has(P.VIEW_TICKETING)) {
    return persona("ticketing", "Tickets Pending", "active", [
      "hero",
      "quickActions",
      "periodPresets",
      "stats",
      "inbox",
      "ticketingQueue",
      "activity",
    ]);
  }

  if (has(P.MANAGE_FINANCE) && has(P.VIEW_FINANCE)) {
    return persona("finance", "Outstanding", "active", [
      "hero",
      "quickActions",
      "periodPresets",
      "stats",
      "inbox",
      "workQueue",
      "activity",
    ]);
  }

  if (has(P.MANAGE_OPERATIONS) || has(P.MANAGE_TRAVELLERS)) {
    return persona("operations", "Open job cards", "active", [
      "hero",
      "quickActions",
      "periodPresets",
      "stats",
      "inbox",
      "workQueue",
      "readiness",
      "activity",
    ]);
  }

  if (has(P.VIEW_CONTRACTING) && !has(P.VIEW_QUERIES)) {
    return persona("contracting", "Proposals Sent", "active", [
      "hero",
      "quickActions",
      "periodPresets",
      "stats",
      "inbox",
      "pipeline",
      "activity",
    ]);
  }

  if (!permissions.length) {
    return persona("sales", "Active queries", "active", ["hero", "periodPresets"]);
  }

  return persona("sales", "Active queries", "active", [
    "hero",
    "quickActions",
    "periodPresets",
    "stats",
    "inbox",
    "pipeline",
    "workQueue",
    "queryTypes",
    "activity",
  ]);
}

/**
 * @param {DashboardPersonaId} id
 * @param {string} featuredMetricLabel
 * @param {'active' | 'confirmed' | 'closed'} defaultQueryTab
 * @param {DashboardSectionId[]} sections
 */
function persona(id, featuredMetricLabel, defaultQueryTab, sections) {
  return {
    defaultQueryTab,
    featuredMetricLabel,
    id,
    sections,
    showOpsProgress: id === "operations" || id === "director",
    showQueryTypes: sections.includes("queryTypes"),
  };
}

export function orderDashboardSections(sections, personaConfig) {
  const order = personaConfig.sections;
  const sectionSet = new Set(sections);
  return order.filter((id) => sectionSet.has(id));
}

const TODAY_SECTION_ORDER = ["inbox", "workQueue", "ticketingQueue", "readiness"];
const REPORTING_SECTION_ORDER = ["pipeline", "queryTypes"];
const SUPPORTING_SECTION_ORDER = ["collapsible", "activity"];

/**
 * Keep the dashboard's action-first hierarchy explicit and testable without
 * coupling it to a particular grid implementation.
 *
 * @param {{ sections: DashboardSectionId[] }} personaConfig
 * @param {DashboardSectionId[]} availableSections
 */
export function groupDashboardSections(personaConfig, availableSections) {
  const enabled = new Set(personaConfig.sections);
  const available = new Set(availableSections);
  const select = (order) => order.filter((id) => enabled.has(id) && available.has(id));

  return {
    overview: select(["stats"]),
    reporting: select(REPORTING_SECTION_ORDER),
    supporting: select(SUPPORTING_SECTION_ORDER),
    today: select(TODAY_SECTION_ORDER),
  };
}
