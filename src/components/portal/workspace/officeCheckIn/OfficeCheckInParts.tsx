"use client";

import type { SignalOutcome } from "@convex/crm/officeCheckInVerification";
import { MapPin, Wifi } from "lucide-react";
import { type ChangeEvent, type ReactNode, type RefObject, useId } from "react";
import { ControlledDialog } from "@/components/ui/application-dialog";
import {
  DAY_STATUS_LABELS,
  DAY_STATUS_TONES,
  type DayStatus,
  describeGeofenceReason,
  describeNetworkReason,
  OUTCOME_LABELS,
  OUTCOME_TONES,
  type StatusTone,
} from "@/lib/officeCheckIn/presentation";
import { PORTAL_Z } from "@/lib/portal/zIndex";
import { Badge } from "../portalWorkspaceListUi";
import type { VerificationRecord } from "./officeCheckInTypes";

export const FIELD_LABEL = "font-medium text-brand-dark text-sm";
export const FIELD_HINT = "text-brand-muted text-xs";

// Badges keep their words on one line; a two-line "Awaiting / review" pill reads as two labels.
export function ToneBadge({ label, tone }: { label: string; tone: StatusTone }) {
  return (
    <span className="inline-flex shrink-0 whitespace-nowrap">
      <Badge label={label} tone={tone} />
    </span>
  );
}

export function OutcomeBadge({ outcome }: { outcome: SignalOutcome }) {
  return <ToneBadge label={OUTCOME_LABELS[outcome]} tone={OUTCOME_TONES[outcome]} />;
}

export function DayStatusBadge({ status }: { status: DayStatus }) {
  return <ToneBadge label={DAY_STATUS_LABELS[status]} tone={DAY_STATUS_TONES[status]} />;
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
    <li className="flex items-start gap-2.5">
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand-muted" />
      <p className="min-w-0 text-pretty text-brand-dark text-sm">
        <span className="font-medium">{label}:</span> {OUTCOME_LABELS[outcome].toLowerCase()}.{" "}
        <span className="text-brand-muted">{reason}</span>
      </p>
    </li>
  );
}

/** Each signal of one clock-in or clock-out, one plain sentence per line. */
export function SignalList({ record }: { record: VerificationRecord }) {
  if (record.requirement === "not_configured") {
    return (
      <p className={FIELD_HINT}>
        No check-in rule was set for this office, so the result is uncertain.
      </p>
    );
  }
  return (
    <ul className="grid gap-2">
      {record.network ? (
        <SignalRow
          icon="network"
          label="Office internet"
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
  "min-h-20 w-full rounded-xl border border-brand-border bg-white px-3 py-2 text-base text-brand-dark outline-none transition-[border-color,box-shadow] focus-visible:border-citius-blue focus-visible:ring-2 focus-visible:ring-citius-blue/15 aria-[invalid=true]:border-red-400 sm:text-sm";

/** Required audit reason. Validated on submit; the error is linked to the field. */
export function ReasonField({
  error,
  help = "Saved in the history with your name.",
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
      <label className={FIELD_LABEL} htmlFor={`${id}-reason`}>
        Reason
      </label>
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
      <p className={FIELD_HINT} id={`${id}-reason-help`}>
        {help}
      </p>
      <FieldError id={`${id}-reason-error`} message={error} />
    </div>
  );
}

export function ServerError({ message }: { message: string }) {
  if (!message) {
    return null;
  }
  return (
    <p
      className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700 text-sm"
      role="alert"
    >
      {message}
    </p>
  );
}

/**
 * The one dialog frame the view uses: the portal's entity-modal layer, a
 * scrolling body and a footer that stays in view on short screens.
 */
export function OfficeDialog({
  busy,
  children,
  onClose,
  open,
  size = "md",
}: {
  busy: boolean;
  children: ReactNode;
  onClose: () => void;
  open: boolean;
  size?: "lg" | "md";
}) {
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      onClose();
    }
  };
  const width = size === "lg" ? "max-w-2xl" : "max-w-lg";
  return (
    <ControlledDialog
      backdropClassName="absolute inset-0 bg-brand-dark/55"
      closeDisabled={busy}
      escapeDisabled={busy}
      onOpenChange={handleOpenChange}
      open={open}
      popupClassName={`relative flex max-h-[calc(100dvh-2rem)] w-full ${width} flex-col overflow-hidden rounded-2xl border border-brand-border bg-white shadow-xl`}
      viewportClassName={`fixed inset-0 ${PORTAL_Z.entityModal} grid place-items-center p-4`}
    >
      {children}
    </ControlledDialog>
  );
}

/** Scrolling content area of an `OfficeDialog`. */
export function DialogBody({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-5 pb-4 sm:px-6">
      {children}
    </div>
  );
}

/** Pinned action row of an `OfficeDialog`; actions trail, the primary last. */
export function DialogFooter({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 border-brand-border/70 border-t px-5 py-3 sm:px-6">
      {children}
    </div>
  );
}
