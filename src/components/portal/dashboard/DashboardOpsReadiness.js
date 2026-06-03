"use client";

import { PORTAL_PERMISSIONS as P } from "@/lib/portal/constants";
import { DashboardEmpty, DashboardPanel, DashboardProgress } from "./DashboardPanel";
import { DashboardActiveTours } from "./DashboardWorkQueue";

export function DashboardOpsReadiness({
  summary,
  has,
  dateRange,
  showAggregateProgress,
  personaId,
}) {
  const hideAggregate = personaId === "operations" && summary.activeTours?.length > 0;

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[1.35fr_0.9fr] max-sm:grid-cols-1">
        <DashboardActiveTours
          tours={summary.activeTours}
          dateRange={dateRange}
          hasJobCards={has(P.VIEW_JOB_CARDS)}
        />
      </div>
      {showAggregateProgress && !hideAggregate ? (
        <DashboardPanel title="Readiness overview">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {has(P.VIEW_TICKETING) && (
              <DashboardProgress
                label="Tickets issued / total pax"
                value={summary.progress.tickets.percent}
              />
            )}
            {has(P.VIEW_VISA) && (
              <DashboardProgress
                label="Visa approved / total pax"
                value={summary.progress.visas.percent}
              />
            )}
            {has(P.VIEW_TRAVELLERS) && (
              <DashboardProgress
                label="Guest data completed"
                value={summary.progress.guestData.percent}
              />
            )}
            {has(P.VIEW_OPERATIONS) && (
              <DashboardProgress
                label="Rooming completed"
                value={summary.progress.rooming.percent}
              />
            )}
            {has(P.VIEW_FINANCE) && (
              <DashboardProgress
                label="Payment received"
                value={summary.progress.payment.percent}
              />
            )}
          </div>
        </DashboardPanel>
      ) : null}
      {!summary.activeTours?.length && has(P.VIEW_JOB_CARDS) ? (
        <DashboardEmpty label="No active tours to show readiness for." />
      ) : null}
    </div>
  );
}
