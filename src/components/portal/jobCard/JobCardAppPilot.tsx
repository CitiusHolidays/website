"use client";

import { api } from "@convex/_generated/api";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { useState } from "react";
import { Button } from "@/components/ui/application-button";
import { formatDisplayDateTime } from "@/lib/formatDate";
import { useTrackedQuery } from "@/lib/portal/trackedConvexSubscriptions";
import { isRuntimeString } from "@/lib/runtimeValues";

interface PilotState {
  canManage: boolean;
  changedAt: number | null;
  changedByName: string | null;
  enabled: boolean;
}

function pilotSummary(pilot: PilotState) {
  const when = pilot.changedAt ? formatDisplayDateTime(pilot.changedAt) : "";
  const by = pilot.changedByName ? ` by ${pilot.changedByName}` : "";
  if (pilot.enabled) {
    return `Started${by}${when ? ` on ${when}` : ""}. Assigned tour managers see this trip in the app and can use every app feature for it.`;
  }
  if (pilot.changedAt) {
    return `Stopped${by}${when ? ` on ${when}` : ""}. Tour managers do not see this trip in the app.`;
  }
  return "Not started. Tour managers do not see this trip in the app until the pilot starts.";
}

function errorText(cause: unknown) {
  if (!(cause instanceof ConvexError && isRuntimeString(cause.data))) {
    return "The pilot could not be changed. Try again.";
  }
  return cause.data === "FORBIDDEN"
    ? "Only the Operations Head, directors, admins and this Job Card's Operations owner can change the pilot."
    : cause.data;
}

/**
 * The per-trip tour manager app pilot (owner decision, 7 Nov 2026). Nothing about the trip shows
 * in Citius Connect until someone starts the pilot; stopping it asks first, because the trip
 * leaves tour managers' phones at once. The Staff Workspace is not affected either way.
 */
export function JobCardAppPilot({ jobCardId }: { jobCardId: string }) {
  const pilot = useTrackedQuery(api.crm.jobCards.getAppPilot, { jobCardId });
  const setAppPilot = useMutation(api.crm.jobCards.setAppPilot);
  const [busy, setBusy] = useState(false);
  const [confirmingStop, setConfirmingStop] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  if (!pilot) {
    return null;
  }
  const apply = async (enabled: boolean) => {
    setBusy(true);
    setError("");
    setStatus("");
    try {
      await setAppPilot({ enabled, jobCardId });
      setStatus(enabled ? "Pilot started." : "Pilot stopped.");
    } catch (cause) {
      setError(errorText(cause));
    }
    setConfirmingStop(false);
    setBusy(false);
  };
  const start = () => apply(true);
  const stop = () => apply(false);
  const askToStop = () => setConfirmingStop(true);
  const keepRunning = () => setConfirmingStop(false);
  return (
    <section
      aria-labelledby="job-card-app-pilot"
      className="rounded-lg border border-brand-border bg-white p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 max-w-prose">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-heading text-base text-brand-dark" id="job-card-app-pilot">
              Tour manager app pilot
            </h2>
            <span
              className={`rounded-full px-2 py-0.5 font-sans font-semibold text-xs ${pilot.enabled ? "bg-citius-blue text-white" : "bg-brand-light text-brand-dark"}`}
            >
              {pilot.enabled ? "On" : "Off"}
            </span>
          </div>
          <p className="mt-1 text-brand-muted text-sm">{pilotSummary(pilot)}</p>
        </div>
        {pilot.canManage && !confirmingStop ? (
          <Button
            className="shrink-0"
            disabled={busy}
            loading={busy}
            onClick={pilot.enabled ? askToStop : start}
            type="button"
            variant={pilot.enabled ? "outline" : "primary"}
          >
            {pilot.enabled ? "Stop pilot" : "Start pilot"}
          </Button>
        ) : null}
      </div>
      {confirmingStop ? (
        <div className="mt-4 rounded-lg border border-brand-border bg-brand-light p-4">
          <p className="font-semibold text-brand-dark text-sm">Stop the pilot for this trip?</p>
          <p className="mt-1 text-brand-muted text-sm">
            The trip disappears from tour managers' phones at once. They can no longer see it, sync
            headcounts or announcements, open passports or record expenses for it in the app. The
            Staff Workspace keeps working as before.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Button disabled={busy} loading={busy} onClick={stop} type="button" variant="danger">
              Stop pilot
            </Button>
            <Button disabled={busy} onClick={keepRunning} type="button" variant="outline">
              Keep it running
            </Button>
          </div>
        </div>
      ) : null}
      {pilot.canManage ? null : (
        <p className="mt-2 text-brand-muted text-xs">
          The Operations Head, directors, admins and this Job Card's Operations owner can change it.
        </p>
      )}
      <p aria-live="polite" className="mt-2 text-brand-muted text-sm empty:hidden" role="status">
        {status}
      </p>
      {error ? (
        <p className="mt-2 text-red-700 text-sm" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
