"use client";

import { useLinkStatus } from "next/link";
import { useEffect, useRef } from "react";
import { beginPortalLoading, endPortalLoading } from "@/components/portal/portalLoadingStore";
import {
  markPortalNavigationPending,
  type PortalPerformanceTarget,
} from "@/lib/portal/navigationPerformance";

export function PortalNavLinkPendingIndicator({
  label,
  pending,
}: {
  label: string;
  pending: boolean;
}) {
  if (!pending) {
    return null;
  }

  return (
    <span
      className="ml-auto inline-flex items-center gap-1.5"
      data-testid="portal-nav-link-pending"
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand-muted/45" />
      <span className="sr-only">Loading {label}</span>
    </span>
  );
}

export default function PortalNavLinkPending({
  label,
  performanceTarget,
}: {
  label: string;
  performanceTarget?: PortalPerformanceTarget | null;
}) {
  const { pending } = useLinkStatus();
  const wasPending = useRef(false);
  const waitRef = useRef<symbol | null>(null);

  useEffect(() => {
    if (pending && !wasPending.current && performanceTarget) {
      wasPending.current = true;
      markPortalNavigationPending(performanceTarget);
    } else if (!pending) {
      wasPending.current = false;
    }
  }, [pending, performanceTarget]);

  useEffect(() => {
    if (pending && !waitRef.current) {
      waitRef.current = beginPortalLoading(`Loading ${label}`);
    } else if (!pending && waitRef.current) {
      endPortalLoading(waitRef.current);
      waitRef.current = null;
    }
    return () => {
      if (waitRef.current) {
        endPortalLoading(waitRef.current);
        waitRef.current = null;
      }
    };
  }, [label, pending]);

  return <PortalNavLinkPendingIndicator label={label} pending={pending} />;
}
