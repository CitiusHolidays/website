"use client";

import { useLinkStatus } from "next/link";
import { useEffect, useRef } from "react";
import { markPortalNavigationPending } from "@/lib/portal/navigationPerformance";

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
      aria-live="polite"
      className="ml-auto inline-flex items-center gap-1.5"
      data-testid="portal-nav-link-pending"
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand-muted/45" />
      <span className="sr-only">Loading {label}</span>
    </span>
  );
}

export default function PortalNavLinkPending({ label }: { label: string }) {
  const { pending } = useLinkStatus();
  const wasPending = useRef(false);

  useEffect(() => {
    if (pending && !wasPending.current) {
      wasPending.current = true;
      markPortalNavigationPending();
    } else if (!pending) {
      wasPending.current = false;
    }
  }, [pending]);

  return <PortalNavLinkPendingIndicator label={label} pending={pending} />;
}
