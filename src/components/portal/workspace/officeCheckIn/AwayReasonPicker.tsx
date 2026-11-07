"use client";

import { api } from "@convex/_generated/api";
import { AWAY_REASONS, type AwayReason } from "@convex/crm/officeCheckInVerification";
import { useMutation } from "convex/react";
import { useState } from "react";
import { AWAY_REASON_LABELS } from "@/lib/officeCheckIn/presentation";
import { formatConvexError } from "../portalWorkspaceListHelpers";
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
  ["CHECK_IN_NOT_FOUND", "This check-in no longer exists. Reload the page."],
]);

function describeFailure<Problem>(problem: Problem) {
  const text = formatConvexError(problem, SAVE_FAILED);
  return REFUSALS.get(text) ?? text;
}

/**
 * Asks where the person is working when their clock-in check didn't place
 * them at the office. Their answer is saved on the session for their manager;
 * it can be changed until a manager has reviewed the session.
 */
export function AwayReasonPicker({ session }: { session: CheckInRecord }) {
  const chooseAwayReason = useMutation(api.crm.officeCheckIns.chooseAwayReason);
  const [saving, setSaving] = useState<AwayReason | null>(null);
  const [error, setError] = useState("");
  const chosen = session.awayReason;

  const choose = async (reason: AwayReason) => {
    if (saving || reason === chosen) {
      return;
    }
    setSaving(reason);
    setError("");
    // Settle first so every path clears the saving state; React Compiler can't compile try/finally.
    const failure = await chooseAwayReason({ checkInId: session._id, reason }).then(
      () => "",
      describeFailure
    );
    setSaving(null);
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
      </div>
      <div className="flex flex-wrap gap-2">
        {AWAY_REASONS.map((reason) => {
          const selected = reason === chosen;
          const pressed = () => choose(reason);
          return (
            <button
              aria-busy={saving === reason || undefined}
              aria-disabled={Boolean(saving) || undefined}
              aria-pressed={selected}
              className={`${
                selected ? "portal-primary-btn" : "portal-outline-btn"
              } min-h-11 px-4 text-sm aria-disabled:cursor-progress aria-disabled:opacity-80`}
              key={reason}
              onClick={pressed}
              type="button"
            >
              {saving === reason ? "Saving…" : AWAY_REASON_LABELS[reason]}
            </button>
          );
        })}
      </div>
      {error ? (
        <p className="text-red-700 text-sm" role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
