"use client";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useConvexAuth, useMutation } from "convex/react";
import { usePathname } from "next/navigation";
import { createContext, type ReactNode, use, useCallback, useLayoutEffect, useRef } from "react";
import { subscribePortalDestinationReady } from "@/lib/portal/portalDestinationReady";
import { useTrackedQuery } from "@/lib/portal/trackedConvexSubscriptions";

interface WorkState {
  complete: boolean;
  count: number;
  eventIds: Id<"notifications">[];
  newActivity: boolean;
}
interface Visit {
  href: string;
  ready: boolean;
  sent: boolean;
  snapshot: Id<"notifications">[] | null;
  viewerKey: string | null;
}
const WorkContext = createContext<{
  byHref: Record<string, WorkState>;
  startVisit: (href: string) => void;
}>({ byHref: {}, startVisit: () => undefined });

export function PortalNavWorkProvider({
  allowed,
  children,
}: {
  allowed?: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const { isAuthenticated } = useConvexAuth();
  const state = useTrackedQuery(
    api.crm.navShortcuts.workState,
    isAuthenticated && allowed ? {} : "skip"
  );
  const acknowledge = useMutation(api.crm.navShortcuts.acknowledgeActivity);
  const stateRef = useRef(state);
  const visitRef = useRef<Visit>({
    href: pathname,
    ready: false,
    sent: false,
    snapshot: null,
    viewerKey: null,
  });
  const pathRef = useRef(pathname);
  const readyRef = useRef<string | null>(null);
  const acknowledgeVisit = useCallback(() => {
    const visit = visitRef.current;
    if (
      !visit.ready ||
      visit.sent ||
      visit.snapshot === null ||
      !visit.viewerKey ||
      visit.href !== pathRef.current
    ) {
      return;
    }
    visit.sent = true;
    if (!visit.snapshot.length) {
      return;
    }
    acknowledge({
      href: visit.href,
      notificationIds: visit.snapshot,
      viewerKey: visit.viewerKey,
    }).catch(() => {
      if (visitRef.current === visit) {
        visit.sent = false;
      }
    });
  }, [acknowledge]);

  useLayoutEffect(() => {
    const oldViewer = stateRef.current?.viewerKey;
    stateRef.current = state;
    const changedViewer = oldViewer !== undefined && oldViewer !== state?.viewerKey;
    if (pathRef.current !== pathname || changedViewer) {
      readyRef.current = null;
    }
    pathRef.current = pathname;
    if (visitRef.current.href !== pathname || changedViewer) {
      visitRef.current = {
        href: pathname,
        ready: false,
        sent: false,
        snapshot: null,
        viewerKey: null,
      };
    }
    const visit = visitRef.current;
    if (state && visit.snapshot === null) {
      visit.snapshot = state.byHref[visit.href]?.eventIds.slice() ?? [];
      visit.viewerKey = state.viewerKey;
    }
    acknowledgeVisit();
  }, [pathname, state, acknowledgeVisit]);

  useLayoutEffect(
    () =>
      subscribePortalDestinationReady((href) => {
        if (href !== pathRef.current) {
          return;
        }
        readyRef.current = href;
        if (href === visitRef.current.href) {
          visitRef.current.ready = true;
          acknowledgeVisit();
        }
      }),
    [acknowledgeVisit]
  );

  const startVisit = (href: string) => {
    const { current } = stateRef;
    visitRef.current = {
      href,
      ready: href === pathRef.current && readyRef.current === href,
      sent: false,
      snapshot: current?.byHref[href]?.eventIds.slice() ?? null,
      viewerKey: current?.viewerKey ?? null,
    };
    acknowledgeVisit();
  };
  return <WorkContext value={{ byHref: state?.byHref ?? {}, startVisit }}>{children}</WorkContext>;
}

export function usePortalNavWork() {
  return use(WorkContext);
}

function WorkloadCount({ state }: { state?: WorkState }) {
  if (!state || (state.complete && state.count === 0)) {
    return null;
  }
  let value: string | number;
  let label: string;
  if (state.complete) {
    value = state.count;
    label = `${state.count} work items need attention`;
  } else if (state.count === 0) {
    value = "…";
    label = "Work count incomplete; more records have not been counted";
  } else {
    value = `≥${state.count}`;
    label = `At least ${state.count} work items need attention; more records have not been counted`;
  }
  return (
    <span title={label}>
      <span aria-hidden>{value}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function PortalNavWorkIndicator({
  hrefs,
  showCount = true,
}: {
  hrefs: string[];
  showCount?: boolean;
}) {
  const { byHref } = usePortalNavWork();
  const state = hrefs.length === 1 ? byHref[hrefs[0]] : undefined;
  const newActivity = hrefs.some((href) => byHref[href]?.newActivity);
  const count = showCount && state && (state.count > 0 || !state.complete) ? state.count : null;
  if (!newActivity && count === null) {
    return null;
  }
  return (
    <span className="ms-auto inline-flex shrink-0 items-center gap-2 ps-2 text-brand-muted text-sm tabular-nums">
      <WorkloadCount state={showCount ? state : undefined} />
      {newActivity ? (
        <span>
          <span aria-hidden className="block size-1.5 rounded-full bg-[#ef8b2c]" />
          <span className="sr-only">New activity</span>
        </span>
      ) : null}
    </span>
  );
}
