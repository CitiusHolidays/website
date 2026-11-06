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
      className="portal-primary-btn min-h-12 w-full px-6 text-base aria-disabled:cursor-progress aria-disabled:opacity-80 sm:w-auto sm:min-w-48 sm:justify-self-start"
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

function TimeFigure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-brand-muted text-xs">{label}</dt>
      <dd className="mt-0.5 font-heading font-semibold text-2xl text-brand-dark tabular-nums">
        {value}
      </dd>
    </div>
  );
}

/** One check's result: a badge, and the reasons only when it didn't pass. */
function CheckResult({ label, record }: { label: string; record: CheckInRecord["clockIn"] }) {
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-brand-dark text-sm">{label}</span>
        <OutcomeBadge outcome={record.outcome} />
      </div>
      {record.outcome === "pass" ? null : <SignalList record={record} />}
    </div>
  );
}

function TodayRecord({ record, timeZone }: { record: CheckInRecord; timeZone: string }) {
  const note = reviewNote(record);
  return (
    <div className="grid content-start gap-4">
      <dl className="grid grid-cols-2 gap-4">
        <TimeFigure label="Clocked in" value={formatOfficeTime(record.clockInAt, timeZone)} />
        <TimeFigure label="Clocked out" value={formatOfficeTime(record.clockOutAt, timeZone)} />
      </dl>
      {record.source === "self" ? (
        <CheckResult label="Clock-in check" record={record.clockIn} />
      ) : null}
      {record.clockOut ? <CheckResult label="Clock-out check" record={record.clockOut} /> : null}
      {note ? <p className="text-brand-muted text-xs">{note}</p> : null}
      {record.correctedAt ? (
        <p className="text-brand-muted text-xs">A manager corrected these times.</p>
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
    <div className="grid gap-2">
      {action ? (
        <ClockButton
          action={action}
          describedBy={showLocationNote ? LOCATION_NOTE_ID : undefined}
          onPress={clock.run}
          phase={clock.phase}
        />
      ) : (
        <p className="text-brand-dark text-sm">
          You've clocked out for today. A manager can correct your times if something is wrong.
        </p>
      )}
      {showLocationNote ? (
        <p className="max-w-prose text-brand-muted text-xs" id={LOCATION_NOTE_ID}>
          Your browser asks for your location once, when you press the button. It isn't tracked
          after that.
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
      subtitle={`${officeName} · ${formatWorkDate(status.workDate)}`}
      title="My day"
    >
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-4">
          {status.office ? (
            <div className="grid gap-1">
              <p className="text-pretty text-brand-dark text-sm">
                {describeRule(status.rule.requirement)}
              </p>
              <p className="text-brand-muted text-xs">
                {describeEnforcement(status.rule.enforcementMode)}
              </p>
            </div>
          ) : null}
          <DayAction clock={clock} status={status} />
          <div aria-live="polite" className="-mt-2 text-sm" role="status">
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
        <div className="min-w-0 border-brand-border/70 border-t pt-4 md:border-s md:border-t-0 md:ps-6 md:pt-0">
          {status.today ? (
            <TodayRecord record={status.today} timeZone={status.timeZone} />
          ) : (
            <p className="text-brand-muted text-sm">
              Not clocked in yet. Your times and the result show here after you clock in.
            </p>
          )}
          <p className="mt-4 text-brand-muted text-xs">Times in {status.timeZone}.</p>
        </div>
      </div>
    </Panel>
  );
}
