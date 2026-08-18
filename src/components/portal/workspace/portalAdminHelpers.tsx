"use client";

import { Loader2 } from "lucide-react";
import { type Key, useEffect, useRef } from "react";
import {
  beginPortalLoading,
  endPortalLoading,
} from "@/components/portal/PortalLoadingAnnouncement";
import { formatDate } from "@/components/portal/PortalModalForm";

export function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-brand-border border-dashed bg-white p-8 text-center text-brand-muted text-sm">
      {label}
    </div>
  );
}

export function LoadingPanel() {
  usePortalLoadingAnnouncement();
  return (
    <div
      aria-busy="true"
      className="grid min-h-60 place-items-center rounded-2xl border border-brand-border bg-white"
    >
      <div aria-hidden="true" className="flex items-center gap-2 text-brand-muted text-sm">
        <Loader2 className="animate-spin text-citius-orange" size={18} />
        Loading portal data
      </div>
    </div>
  );
}

export function PortalViewLoading() {
  usePortalLoadingAnnouncement();
  return (
    <div aria-busy="true" className="min-h-[12rem]">
      <div
        aria-hidden="true"
        className="min-h-[12rem] animate-pulse rounded-xl bg-brand-light/60"
      />
    </div>
  );
}

function usePortalLoadingAnnouncement() {
  const waitRef = useRef<symbol | null>(null);
  useEffect(() => {
    waitRef.current = beginPortalLoading();
    return () => {
      if (waitRef.current) {
        endPortalLoading(waitRef.current);
        waitRef.current = null;
      }
    };
  }, []);
}

export function Timeline({
  rows,
}: {
  rows: Array<{ actorName?: string; createdAt?: string; id: Key; message?: string }>;
}) {
  if (!rows.length) {
    return <EmptyState label="No records yet." />;
  }
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div className="rounded-md border border-brand-border bg-brand-light p-3" key={row.id}>
          <div className="font-semibold text-sm">{row.message}</div>
          <div className="mt-1 text-brand-muted text-xs">
            {row.actorName} - {formatDate(row.createdAt)}
          </div>
        </div>
      ))}
    </div>
  );
}
