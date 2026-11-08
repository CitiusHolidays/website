"use client";

import { api } from "@convex/_generated/api";
import {
  AWAY_REASONS,
  type AwayReason,
  awayReasonNeedsLocation,
  type GeolocationErrorCode,
  type LocationReading,
} from "@convex/crm/officeCheckInVerification";
import { useMutation } from "convex/react";
import { useState } from "react";
import { readLocation } from "@/lib/officeCheckIn/location";
import {
  AWAY_REASON_LABELS,
  describeAwayLocationProblem,
  type LocationHelpPlatform,
  locationHelpPlatform,
  needsLocationHelp,
} from "@/lib/officeCheckIn/presentation";
import { formatConvexError } from "../portalWorkspaceListHelpers";
import { LocationHelp } from "./LocationHelp";
import type { CheckInRecord } from "./officeCheckInTypes";

const PROMPT_ID = "office-check-in-away-prompt";
const SAVE_FAILED = "Your answer wasn't saved. Try again.";

/** Server refusals, in words; anything else shows as the server sent it. */
const REFUSALS = new Map([
  ["ALREADY_REVIEWED", "A manager has already reviewed this check-in, so the answer can't change."],
  [
    "AWAY_REASON_NOT_NEEDED",
    "Your check-in now places you at the office, so there's nothing to choose.",
  ],
  ["AWAY_LOCATION_REQUIRED", "This answer needs your location. Try again and allow location."],
  ["AWAY_LOCATION_INVALID", "Your location reading couldn't be used. Try again."],
  ["CHECK_IN_NOT_FOUND", "This check-in no longer exists. Reload the page."],
]);

function describeFailure<Problem>(problem: Problem) {
  const text = formatConvexError(problem, SAVE_FAILED);
  return REFUSALS.get(text) ?? text;
}

type Phase = { kind: "idle" } | { kind: "locating" | "saving"; reason: AwayReason };

interface LocationProblem {
  code: GeolocationErrorCode;
  platform: LocationHelpPlatform | null;
}

function busyLabel(phase: Phase, reason: AwayReason) {
  if (phase.kind === "idle" || phase.reason !== reason) {
    return AWAY_REASON_LABELS[reason];
  }
  return phase.kind === "locating" ? "Getting your location…" : "Saving…";
}

/**
 * Asks where the person is working when their clock-in check didn't place them at the office.
 * On tour and On market visit read the device's location once, when pressed, and save it with
 * the answer for the people who oversee them; without a location those two can't be saved. The
 * answer can be changed until a manager has reviewed the session.
 */
export function AwayReasonPicker({ session }: { session: CheckInRecord }) {
  const chooseAwayReason = useMutation(api.crm.officeCheckIns.chooseAwayReason);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [error, setError] = useState("");
  const [locationProblem, setLocationProblem] = useState<LocationProblem | null>(null);
  const chosen = session.awayReason;

  const choose = async (reason: AwayReason) => {
    if (phase.kind !== "idle" || reason === chosen) {
      return;
    }
    setError("");
    setLocationProblem(null);
    let location: LocationReading | null = null;
    if (awayReasonNeedsLocation(reason)) {
      setPhase({ kind: "locating", reason });
      const reading = await readLocation();
      if (reading.kind !== "position") {
        const code = reading.kind === "error" ? reading.code : "position_unavailable";
        setPhase({ kind: "idle" });
        setError(describeAwayLocationProblem(code));
        setLocationProblem({ code, platform: locationHelpPlatform(navigator) });
        return;
      }
      location = reading;
    }
    setPhase({ kind: "saving", reason });
    const args = location
      ? { checkInId: session._id, location, reason }
      : { checkInId: session._id, reason };
    // Settle first so every path clears the busy state; React Compiler can't compile try/finally.
    const failure = await chooseAwayReason(args).then(() => "", describeFailure);
    setPhase({ kind: "idle" });
    setError(failure);
  };

  return (
    <fieldset
      aria-labelledby={PROMPT_ID}
      className={`grid min-w-0 gap-3 rounded-lg border px-3 py-3 ${
        chosen ? "border-brand-border bg-white" : "border-amber-200 bg-amber-50"
      }`}
    >
      <div className="grid gap-0.5">
        <p className="font-medium text-brand-dark text-sm" id={PROMPT_ID}>
          {chosen ? "Where you're working today" : "Where are you working today?"}
        </p>
        <p className="text-brand-muted text-xs">
          {chosen
            ? "Your manager sees this with your check-in. You can change it."
            : "We couldn't confirm you're at the office. Choose one so your manager knows."}
        </p>
        <p className="text-brand-muted text-xs">
          On tour and On market visit share your location at that moment with the people who oversee
          you, so they can check it. It is kept with this check-in for 3 months.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {AWAY_REASONS.map((reason) => {
          const selected = reason === chosen;
          const busy = phase.kind !== "idle" && phase.reason === reason;
          const pressed = () => choose(reason);
          return (
            <button
              aria-busy={busy || undefined}
              aria-disabled={phase.kind !== "idle" || undefined}
              aria-pressed={selected}
              className={`${
                selected ? "portal-primary-btn" : "portal-outline-btn"
              } min-h-11 px-4 text-sm aria-disabled:cursor-progress aria-disabled:opacity-80`}
              key={reason}
              onClick={pressed}
              type="button"
            >
              {busyLabel(phase, reason)}
            </button>
          );
        })}
      </div>
      {error ? (
        <p className="text-red-700 text-sm" role="alert">
          {error}
        </p>
      ) : null}
      {locationProblem && needsLocationHelp(locationProblem.code) ? (
        <LocationHelp platform={locationProblem.platform} />
      ) : null}
    </fieldset>
  );
}
