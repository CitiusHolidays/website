const NAVIGATION_MARKS = {
  firstQueryRow: "citius-portal-navigation-first-query-row",
  pending: "citius-portal-navigation-pending",
  routeReady: "citius-portal-navigation-route-ready",
  start: "citius-portal-navigation-start",
} as const;

let activeNavigation = false;

function mark(name: string) {
  if (typeof performance === "undefined" || typeof performance.mark !== "function") {
    return;
  }
  performance.mark(name);
}

export function markPortalNavigationStart() {
  activeNavigation = true;
  mark(NAVIGATION_MARKS.start);
}

export function markPortalNavigationPending() {
  if (activeNavigation) {
    mark(NAVIGATION_MARKS.pending);
  }
}

export function markPortalNavigationRouteReady() {
  if (activeNavigation) {
    mark(NAVIGATION_MARKS.routeReady);
  }
}

export function markPortalNavigationFirstQueryRow() {
  if (activeNavigation) {
    mark(NAVIGATION_MARKS.firstQueryRow);
    activeNavigation = false;
  }
}
