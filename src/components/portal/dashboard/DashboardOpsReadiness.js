"use client";

import { PORTAL_PERMISSIONS as P } from "@/lib/portal/constants";
import { DashboardPanel, DashboardProgress } from "./DashboardPanel";
import { DashboardActiveTours } from "./DashboardWorkQueue";

export function DashboardOpsReadiness({
  summary,
  has,
  dateRange,
  showAggregateProgress,
  personaId,
}) {
  const hideAggregate = !showAggregateProgress;
  const rows = [
    has(P.VIEW_TRAVELLERS) && {
      label: "Travellers",
      progress: summary.progress.guestData,
      tone: "blue",
    },
    has(P.VIEW_TRAVELLERS) && {
      label: "Passport",
      progress: summary.progress.passport,
      tone: "blue",
    },
    has(P.VIEW_VISA) && {
      label: "Visa",
      progress: summary.progress.visas,
      tone: "blue",
    },
    has(P.VIEW_OPERATIONS) && {
      label: "Rooming",
      progress: summary.progress.rooming,
      tone: "blue",
    },
    has(P.VIEW_JOB_CARDS) && {
      label: "Tour Manager",
      progress: summary.progress.tourManager,
      tone: "orange",
    },
    has(P.VIEW_FINANCE) && {
      label: "Payment",
      progress: summary.progress.payment,
      tone: "orange",
    },
  ].filter(Boolean);

  return (
    <div className="space-y-5">
      {personaId === "operations" ? (
        <DashboardActiveTours
          dateRange={dateRange}
          hasJobCards={has(P.VIEW_JOB_CARDS)}
          tours={summary.activeTours}
        />
      ) : null}
      {!hideAggregate && rows.length ? (
        <DashboardPanel title="Operations readiness">
          <div className="space-y-3">
            {rows.map((row) => (
              <DashboardProgress
                key={row.label}
                label={row.label}
                meta={row.progress ? `${row.progress.done} / ${row.progress.total}` : undefined}
                tone={row.tone}
                value={row.progress?.percent ?? 0}
              />
            ))}
          </div>
        </DashboardPanel>
      ) : null}
    </div>
  );
}
