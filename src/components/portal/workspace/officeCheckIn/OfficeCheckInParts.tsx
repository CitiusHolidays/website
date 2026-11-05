"use client";

import type { SignalOutcome } from "@convex/crm/officeCheckInVerification";
import { MapPin, Wifi } from "lucide-react";
import { type ChangeEvent, type RefObject, useId } from "react";
import {
  DAY_STATUS_LABELS,
  DAY_STATUS_TONES,
  type DayStatus,
  describeGeofenceReason,
  describeNetworkReason,
  OUTCOME_LABELS,
  OUTCOME_TONES,
} from "@/lib/officeCheckIn/presentation";
import { Badge } from "../portalWorkspaceListUi";
import type { VerificationRecord } from "./officeCheckInTypes";

// Badges keep their word on one line; a two-line "Awaiting / review" pill reads as two labels.
export function OutcomeBadge({ outcome }: { outcome: SignalOutcome }) {
  return (
    <span className="inline-flex shrink-0 whitespace-nowrap">
      <Badge label={OUTCOME_LABELS[outcome]} tone={OUTCOME_TONES[outcome]} />
    </span>
  );
}

export function DayStatusBadge({ status }: { status: DayStatus }) {
  return (
    <span className="inline-flex shrink-0 whitespace-nowrap">
      <Badge label={DAY_STATUS_LABELS[status]} tone={DAY_STATUS_TONES[status]} />
    </span>
  );
}

function SignalRow({
  icon,
  label,
  outcome,
  reason,
}: {
  icon: "location" | "network";
  label: string;
  outcome: SignalOutcome;
  reason: string;
}) {
  const Icon = icon === "network" ? Wifi : MapPin;
  return (
    <li className="flex items-start gap-3 py-2.5">
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand-muted" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-brand-dark text-sm">{label}</span>
          <OutcomeBadge outcome={outcome} />
        </div>
        <p className="mt-0.5 text-pretty text-brand-muted text-xs leading-relaxed">{reason}</p>
      </div>
    </li>
  );
}

/** The per-signal result of one clock-in or clock-out, in plain language. */
export function SignalList({ record }: { record: VerificationRecord }) {
  if (record.requirement === "not_configured") {
    return (
      <p className="text-brand-muted text-xs">
        No check-in rule was set for this office, so the result is uncertain.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-brand-border/70">
      {record.network ? (
        <SignalRow
          icon="network"
          label="Office network"
          outcome={record.network.outcome}
          reason={describeNetworkReason(record.network.reason, record.network.matchedLabel)}
        />
      ) : null}
      {record.geofence ? (
        <SignalRow
          icon="location"
          label="Location"
          outcome={record.geofence.outcome}
          reason={describeGeofenceReason(record.geofence.reason, record.geofence.accuracyMeters)}
        />
      ) : null}
    </ul>
  );
}

export function FieldError({ id, message }: { id: string; message: string | null }) {
  if (!message) {
    return null;
  }
  return (
    <p className="mt-1 text-red-700 text-xs" id={id}>
      {message}
    </p>
  );
}

const TEXTAREA_CLASS =
  "min-h-24 w-full rounded-xl border border-brand-border bg-white px-3 py-2 text-brand-dark text-sm outline-none transition-[border-color,box-shadow] focus-visible:border-citius-blue focus-visible:ring-2 focus-visible:ring-citius-blue/15 aria-[invalid=true]:border-red-400";

/** Required audit reason. Validated on submit; the error is linked to the field. */
export function ReasonField({
  error,
  help = "Saved in the audit log with your name.",
  inputRef,
  onChange,
  placeholder = "For example: confirmed with the branch manager",
  value,
}: {
  error: string | null;
  help?: string;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  const id = useId();
  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) =>
    onChange(event.currentTarget.value);
  return (
    <div className="grid gap-1.5">
      <label className="font-medium text-brand-dark text-sm" htmlFor={`${id}-reason`}>
        Reason
      </label>
      <p className="text-brand-muted text-xs" id={`${id}-reason-help`}>
        {help}
      </p>
      <textarea
        aria-describedby={error ? `${id}-reason-help ${id}-reason-error` : `${id}-reason-help`}
        aria-invalid={error ? true : undefined}
        className={TEXTAREA_CLASS}
        id={`${id}-reason`}
        maxLength={500}
        name="reason"
        onChange={handleChange}
        placeholder={placeholder}
        ref={inputRef}
        value={value}
      />
      <FieldError id={`${id}-reason-error`} message={error} />
    </div>
  );
}
