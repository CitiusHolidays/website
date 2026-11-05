"use client";

import type { LocationReading } from "@convex/crm/officeCheckInVerification";
import { Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import type { OfficeCheckInAction } from "@/lib/officeCheckIn/contracts";
import { readLocation } from "@/lib/officeCheckIn/location";
import {
  dayStatusFor,
  describeCheckInError,
  describeEnforcement,
  describeLocationProblem,
  describeRule,
  formatOfficeTime,
  formatWorkDate,
} from "@/lib/officeCheckIn/presentation";
import { submitOfficeCheckIn } from "@/lib/officeCheckIn/submit";
import { Panel } from "../portalWorkspaceListUi";
import { DayStatusBadge, OutcomeBadge, SignalList } from "./OfficeCheckInParts";
import type { CheckInRecord, MyCheckInStatus } from "./officeCheckInTypes";

type ClockPhase = "idle" | "locating" | "sending";

interface ClockFeedback {
  message: string;
  tone: "error" | "info";
}

const NOT_REQUESTED: LocationReading = { kind: "not_requested" };

function successMessage(action: OfficeCheckInAction, replayed: boolean) {
  if (replayed) {
    return "You were already clocked in today. Nothing changed.";
  }
  return action === "clock_in" ? "Clock-in recorded." : "Clock-out recorded.";
}

/**
 * Owns one Clock in / Clock out press: an optional single location reading,
 * then one POST to the check-in route. A second press while one is running is
 * ignored.
 */
function useClockAction(needsLocation: boolean) {
  const [phase, setPhase] = useState<ClockPhase>("idle");
  const [feedback, setFeedback] = useState<ClockFeedback | null>(null);
  const inFlightRef = useRef(false);

  const run = async (action: OfficeCheckInAction) => {
    if (inFlightRef.current) {
      return;
    }
    inFlightRef.current = true;
    setFeedback(null);
    let location = NOT_REQUESTED;
    if (needsLocation) {
      setPhase("locating");
      location = await readLocation();
    }
    setPhase("sending");
    const result = await submitOfficeCheckIn({ action, location });
    inFlightRef.current = false;
    setPhase("idle");
    if (!result.ok) {
      setFeedback({ message: describeCheckInError(result.code), tone: "error" });
      return;
    }
    const locationNote =
      location.kind === "error" ? ` ${describeLocationProblem(location.code)}` : "";
    setFeedback({
      message: `${successMessage(action, result.replayed)}${locationNote}`,
      tone: "info",
    });
  };

  return { feedback, phase, run };
}

function busyLabel(phase: ClockPhase) {
  return phase === "locating" ? "Getting your location…" : "Recording…";
}

const LOCATION_NOTE_ID = "office-check-in-location-note";

function ClockButton({
  action,
  describedBy,
  onPress,
  phase,
}: {
  action: OfficeCheckInAction;
  describedBy?: string;
  onPress: (action: OfficeCheckInAction) => void;
  phase: ClockPhase;
}) {
  const busy = phase !== "idle";
  const idleLabel = action === "clock_in" ? "Clock in" : "Clock out";
  const text = busy ? busyLabel(phase) : idleLabel;
  // Stays focusable while busy (aria-disabled, not disabled) so keyboard focus
  // is not dropped to the page when the press starts; useClockAction ignores
  // repeat presses until the first one finishes.
  const handlePress = () => {
    if (!busy) {
      onPress(action);
    }
  };
  return (
    <button
      aria-busy={busy || undefined}
      aria-describedby={describedBy}
      aria-disabled={busy || undefined}
      className="portal-primary-btn min-w-36 aria-disabled:cursor-progress aria-disabled:opacity-80"
      onClick={handlePress}
      type="button"
    >
      {busy ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
      {text}
    </button>
  );
}

function reviewNote(record: CheckInRecord) {
  if (record.source === "manager_entry") {
    return record.review
      ? `Entered by ${record.review.reviewerName}: ${record.review.reason}`
      : "Entered by a manager.";
  }
  if (record.admission === "pending_review") {
    return "A manager will review this check-in before it counts.";
  }
  if (record.review) {
    const verb = record.review.decision === "accepted" ? "Accepted" : "Rejected";
    return `${verb} by ${record.review.reviewerName}: ${record.review.reason}`;
  }
  return null;
}

function TodayRecord({ record, timeZone }: { record: CheckInRecord; timeZone: string }) {
  const note = reviewNote(record);
  return (
    <div className="grid gap-4">
      <dl className="grid grid-cols-2 gap-3">
        <div>
          <dt className="text-brand-muted text-xs">Clocked in</dt>
          <dd className="mt-0.5 font-heading font-semibold text-brand-dark text-xl tabular-nums">
            {formatOfficeTime(record.clockInAt, timeZone)}
          </dd>
        </div>
        <div>
          <dt className="text-brand-muted text-xs">Clocked out</dt>
          <dd className="mt-0.5 font-heading font-semibold text-brand-dark text-xl tabular-nums">
            {formatOfficeTime(record.clockOutAt, timeZone)}
          </dd>
        </div>
      </dl>
      {note ? <p className="text-brand-muted text-xs">{note}</p> : null}
      {record.correctedAt ? (
        <p className="text-brand-muted text-xs">A manager corrected these times.</p>
      ) : null}
      {record.source === "self" ? (
        <section aria-label="Clock-in check" className="grid gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium text-brand-dark text-sm">Clock-in check</h3>
            <OutcomeBadge outcome={record.clockIn.outcome} />
          </div>
          <SignalList record={record.clockIn} />
        </section>
      ) : null}
      {record.clockOut ? (
        <section aria-label="Clock-out check" className="grid gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium text-brand-dark text-sm">Clock-out check</h3>
            <OutcomeBadge outcome={record.clockOut.outcome} />
          </div>
          <SignalList record={record.clockOut} />
        </section>
      ) : null}
    </div>
  );
}

function blockedReason(status: MyCheckInStatus) {
  if (!status.hasStaffProfile) {
    return "Your staff profile isn't active, so you can't clock in. Contact an admin.";
  }
  if (!status.office) {
    return "You aren't assigned to an office yet. Ask an admin to assign you, then come back to clock in.";
  }
  if (!status.office.active) {
    return "Your office is marked inactive. Ask an admin to check your office assignment.";
  }
  return null;
}

function nextAction(today: CheckInRecord | null): OfficeCheckInAction | null {
  if (!today) {
    return "clock_in";
  }
  return today.status === "open" ? "clock_out" : null;
}

function DayAction({
  status,
  clock,
}: {
  clock: ReturnType<typeof useClockAction>;
  status: MyCheckInStatus;
}) {
  const blocked = blockedReason(status);
  if (blocked) {
    return <p className="text-brand-dark text-sm">{blocked}</p>;
  }
  const action = nextAction(status.today);
  const showLocationNote = Boolean(action && status.rule.needsLocation);
  return (
    <div className="grid gap-3">
      {action ? (
        <div className="flex flex-wrap items-center gap-3">
          <ClockButton
            action={action}
            describedBy={showLocationNote ? LOCATION_NOTE_ID : undefined}
            onPress={clock.run}
            phase={clock.phase}
          />
        </div>
      ) : (
        <p className="text-brand-dark text-sm">
          You've clocked out for today. A manager can correct your times if something is wrong.
        </p>
      )}
      {showLocationNote ? (
        <p className="text-brand-muted text-xs" id={LOCATION_NOTE_ID}>
          When you press {action === "clock_in" ? "Clock in" : "Clock out"}, your browser asks for
          your location once to compare it with the office area. It isn't tracked after that.
        </p>
      ) : null}
    </div>
  );
}

/** "Pune office" rather than "Pune office, Pune" when the name already says the city. */
function officeLabel(office: { city: string | null; name: string }) {
  const { city, name } = office;
  if (!city || name.toLowerCase().includes(city.toLowerCase())) {
    return name;
  }
  return `${name}, ${city}`;
}

export function MyDayPanel({ status }: { status: MyCheckInStatus }) {
  const clock = useClockAction(status.rule.needsLocation);
  const dayStatus = dayStatusFor(status.today);
  const officeName = status.office ? officeLabel(status.office) : "No office assigned";
  return (
    <Panel
      action={<DayStatusBadge status={dayStatus} />}
      subtitle={`${formatWorkDate(status.workDate)} · times in office time (${status.timeZone})`}
      title="My day"
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="grid content-start gap-4">
          <div>
            <p className="font-heading font-semibold text-brand-dark text-lg">{officeName}</p>
            {status.office ? (
              <p className="mt-1 text-brand-dark text-sm">
                {describeRule(status.rule.requirement)}
              </p>
            ) : null}
            {status.office ? (
              <p className="mt-1 text-brand-muted text-xs">
                {describeEnforcement(status.rule.enforcementMode)}
              </p>
            ) : null}
          </div>
          <DayAction clock={clock} status={status} />
          <div aria-live="polite" className="min-h-5 text-sm" role="status">
            {clock.feedback?.tone === "info" ? (
              <p className="text-brand-dark">{clock.feedback.message}</p>
            ) : null}
          </div>
          {clock.feedback?.tone === "error" ? (
            <p
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700 text-sm"
              role="alert"
            >
              {clock.feedback.message}
            </p>
          ) : null}
          {status.openFromEarlierDay && !status.today ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900 text-xs">
              Your check-in from {formatWorkDate(status.openFromEarlierDay.workDate)} has no
              clock-out. A manager can add the time.
            </p>
          ) : null}
        </div>
        <div className="min-w-0 border-brand-border/70 lg:border-s lg:ps-6">
          {status.today ? (
            <TodayRecord record={status.today} timeZone={status.timeZone} />
          ) : (
            <p className="text-brand-muted text-sm">
              No check-in yet today. Your times and the check result appear here after you clock in.
            </p>
          )}
        </div>
      </div>
    </Panel>
  );
}
