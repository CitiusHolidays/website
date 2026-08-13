export const PORTAL_PERFORMANCE_TARGETS = [
  "queries",
  "proposals",
  "job-cards",
  "contracting",
  "finance",
  "tickets",
  "hotels",
  "visa",
] as const;

export type PortalPerformanceTarget = (typeof PORTAL_PERFORMANCE_TARGETS)[number];
export type PortalFirstContent = "empty" | "row";

const TARGET_BY_HREF: Record<string, PortalPerformanceTarget> = {
  "/portal/contracting": "contracting",
  "/portal/finance": "finance",
  "/portal/hotels": "hotels",
  "/portal/job-cards": "job-cards",
  "/portal/proposals": "proposals",
  "/portal/queries": "queries",
  "/portal/tickets": "tickets",
  "/portal/visa": "visa",
};

const NAVIGATION_MARKS = {
  firstContent: "citius-portal-navigation-first-content",
  pending: "citius-portal-navigation-pending",
  routeReady: "citius-portal-navigation-route-ready",
  start: "citius-portal-navigation-start",
} as const;

export interface PortalNavigationSnapshot {
  applicationPayloadBytes: number;
  duplicateSubscriptions: number;
  firstContent?: PortalFirstContent;
  firstContentAt?: number;
  logicalSubscriptions: number;
  pendingAt?: number;
  routeReadyAt?: number;
  startedAt: number;
  subscriptions: string[];
  target: PortalPerformanceTarget;
}

export interface PortalPerformanceSubscription {
  active: boolean;
  name: string;
  payload: unknown;
  ready: boolean;
}

interface PortalPerformanceGlobal {
  __CITIUS_PORTAL_PERFORMANCE__?: PortalNavigationSnapshot | null;
  __CITIUS_PORTAL_PRELOADS__?: Partial<Record<PortalPerformanceTarget, Promise<unknown>>>;
}

const SAFE_SUBSCRIPTION_NAME = /^[A-Za-z0-9._-]+$/;
let activeNavigation: PortalNavigationSnapshot | null = null;
let lastNavigation: PortalNavigationSnapshot | null = null;

function now() {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}

function mark(name: string) {
  if (typeof performance === "undefined" || typeof performance.mark !== "function") {
    return;
  }
  performance.mark(name);
}

function publish(snapshot: PortalNavigationSnapshot | null) {
  (globalThis as PortalPerformanceGlobal).__CITIUS_PORTAL_PERFORMANCE__ = snapshot;
}

function updateActive(
  target: PortalPerformanceTarget,
  update: (snapshot: PortalNavigationSnapshot) => PortalNavigationSnapshot
) {
  if (!activeNavigation || activeNavigation.target !== target) {
    return;
  }
  activeNavigation = update(activeNavigation);
  lastNavigation = activeNavigation;
  publish(activeNavigation);
}

export function resetPortalNavigationPerformance() {
  activeNavigation = null;
  lastNavigation = null;
  publish(null);
}

export function getPortalNavigationSnapshot() {
  return lastNavigation;
}

export function getPortalPerformanceTarget(href: string) {
  return TARGET_BY_HREF[href] ?? null;
}

export function markPortalNavigationStart(target: PortalPerformanceTarget) {
  activeNavigation = {
    applicationPayloadBytes: 0,
    duplicateSubscriptions: 0,
    logicalSubscriptions: 0,
    startedAt: now(),
    subscriptions: [],
    target,
  };
  lastNavigation = activeNavigation;
  publish(activeNavigation);
  mark(NAVIGATION_MARKS.start);
}

export function markPortalNavigationPending(target: PortalPerformanceTarget) {
  updateActive(target, (snapshot) => ({ ...snapshot, pendingAt: now() }));
  if (activeNavigation && activeNavigation.target === target) {
    mark(NAVIGATION_MARKS.pending);
  }
}

export function markPortalNavigationRouteReady(target: PortalPerformanceTarget) {
  updateActive(target, (snapshot) => ({ ...snapshot, routeReadyAt: now() }));
  if (activeNavigation && activeNavigation.target === target) {
    mark(NAVIGATION_MARKS.routeReady);
  }
}

export function recordPortalNavigationWorkload({
  applicationPayloadBytes,
  duplicateSubscriptions,
  logicalSubscriptions,
  subscriptions,
  target,
}: {
  applicationPayloadBytes: number;
  duplicateSubscriptions?: number;
  logicalSubscriptions?: number;
  subscriptions: string[];
  target: PortalPerformanceTarget;
}) {
  if (subscriptions.some((name) => !SAFE_SUBSCRIPTION_NAME.test(name))) {
    throw new Error("Portal performance metrics require privacy-safe subscription names");
  }
  const uniqueSubscriptions = new Set(subscriptions);
  const measuredLogicalSubscriptions = logicalSubscriptions ?? subscriptions.length;
  const measuredDuplicateSubscriptions =
    duplicateSubscriptions ?? subscriptions.length - uniqueSubscriptions.size;
  if (
    !Number.isInteger(measuredLogicalSubscriptions) ||
    measuredLogicalSubscriptions !== subscriptions.length ||
    !Number.isInteger(measuredDuplicateSubscriptions) ||
    measuredDuplicateSubscriptions < 0 ||
    measuredDuplicateSubscriptions > measuredLogicalSubscriptions
  ) {
    throw new Error("Portal performance metrics require internally consistent subscription counts");
  }
  updateActive(target, (snapshot) => ({
    ...snapshot,
    applicationPayloadBytes: Math.max(0, Math.round(applicationPayloadBytes)),
    duplicateSubscriptions: measuredDuplicateSubscriptions,
    logicalSubscriptions: measuredLogicalSubscriptions,
    subscriptions: [...subscriptions],
  }));
}

export function measurePortalNavigationWorkload(
  measurements: readonly PortalPerformanceSubscription[]
) {
  const activeMeasurements = measurements.filter((measurement) => measurement.active);
  if (
    activeMeasurements.length === 0 ||
    activeMeasurements.some((measurement) => !measurement.ready)
  ) {
    return null;
  }
  const encoder = new TextEncoder();
  return {
    applicationPayloadBytes: activeMeasurements.reduce(
      (total, measurement) =>
        total + encoder.encode(JSON.stringify(measurement.payload ?? null)).byteLength,
      0
    ),
    subscriptions: activeMeasurements.map((measurement) => measurement.name),
  };
}

export function trackPortalNavigationPreload(
  target: PortalPerformanceTarget,
  preload: Promise<unknown>
) {
  const portalGlobal = globalThis as PortalPerformanceGlobal;
  portalGlobal.__CITIUS_PORTAL_PRELOADS__ = {
    ...portalGlobal.__CITIUS_PORTAL_PRELOADS__,
    [target]: preload,
  };
}

export function markPortalNavigationFirstContent(
  target: PortalPerformanceTarget,
  firstContent: PortalFirstContent
) {
  if (
    !activeNavigation ||
    activeNavigation.target !== target ||
    activeNavigation.firstContentAt !== undefined
  ) {
    return;
  }
  updateActive(target, (snapshot) => ({ ...snapshot, firstContent, firstContentAt: now() }));
  mark(NAVIGATION_MARKS.firstContent);
}
