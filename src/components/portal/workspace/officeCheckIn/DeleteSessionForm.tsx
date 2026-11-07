"use client";

import { api } from "@convex/_generated/api";
import { useMutation } from "convex/react";
import { type FormEvent, useRef, useState } from "react";
import { usePortalToast } from "@/components/portal/PortalToast";
import { ControlledDialogClose, ControlledDialogTitle } from "@/components/ui/application-dialog";
import {
  DELETE_SESSION_COPY,
  deleteReasonProblem,
  formatSessionSpan,
  type SessionDeletion,
} from "@/lib/officeCheckIn/presentation";
import { formatConvexError } from "../portalWorkspaceListHelpers";
import { DialogBody, DialogFooter, ReasonField, ServerError } from "./OfficeCheckInParts";
import type { CheckInRecord } from "./officeCheckInTypes";

const REASON_HELP = {
  erase: "Optional. It isn't saved, because nothing about the session is kept.",
  trail: "Required. Saved with the deletion record under your name.",
} satisfies Record<SessionDeletion, string>;

/**
 * Confirms deleting one session. Admin erases it with its history; Directors
 * leave a deletion record with their reason. The server decides which applies.
 */
export function DeleteSessionForm({
  deletion,
  onBack,
  onBusyChange,
  onDone,
  personName,
  session,
  subtitle,
  timeZone,
}: {
  deletion: SessionDeletion;
  onBack: (() => void) | null;
  onBusyChange: (busy: boolean) => void;
  onDone: () => void;
  personName: string | null;
  session: CheckInRecord;
  subtitle: string;
  timeZone: string;
}) {
  const toast = usePortalToast();
  const deleteCheckIn = useMutation(api.crm.officeCheckIns.deleteCheckIn);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [serverError, setServerError] = useState("");
  const [busy, setBusy] = useState(false);
  const reasonRef = useRef<HTMLTextAreaElement | null>(null);
  const span = formatSessionSpan(session, timeZone);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) {
      return;
    }
    const problem = deleteReasonProblem(reason, deletion);
    setReasonError(problem);
    if (problem) {
      reasonRef.current?.focus();
      return;
    }
    setBusy(true);
    onBusyChange(true);
    setServerError("");
    const trimmed = reason.trim();
    // Settle the request first so every path unlocks; no try/finally, which React Compiler
    // cannot compile.
    const failure = await deleteCheckIn(
      trimmed ? { checkInId: session._id, reason: trimmed } : { checkInId: session._id }
    ).then(
      () => "",
      (error) => formatConvexError(error, "Couldn't delete the session. Try again.")
    );
    setBusy(false);
    onBusyChange(false);
    if (failure) {
      setServerError(failure);
      return;
    }
    // Close only after the busy lock is released, so the dialog is allowed to close.
    toast.success(personName ? `Session deleted for ${personName}.` : "Session deleted.");
    onDone();
  };

  return (
    <form className="flex min-h-0 flex-1 flex-col" noValidate onSubmit={submit}>
      <DialogBody>
        <div className="mb-4">
          <ControlledDialogTitle className="font-heading font-semibold text-citius-blue text-lg">
            Delete session?
          </ControlledDialogTitle>
          <p className="mt-1 text-brand-muted text-sm">{subtitle}</p>
        </div>
        <p className="font-heading font-semibold text-brand-dark text-lg tabular-nums">{span}</p>
        <p className="mt-2 text-brand-dark text-sm">{DELETE_SESSION_COPY[deletion]}</p>
        <div className="mt-4">
          <ReasonField
            error={reasonError}
            help={REASON_HELP[deletion]}
            inputRef={reasonRef}
            onChange={setReason}
            placeholder="For example: test clock-in"
            value={reason}
          />
        </div>
        <div className="mt-3">
          <ServerError message={serverError} />
        </div>
      </DialogBody>
      <DialogFooter>
        {onBack ? (
          <button className="portal-outline-btn" disabled={busy} onClick={onBack} type="button">
            Back
          </button>
        ) : (
          <ControlledDialogClose className="portal-outline-btn" disabled={busy} type="button">
            Cancel
          </ControlledDialogClose>
        )}
        <button
          aria-busy={busy || undefined}
          className="portal-danger-btn"
          disabled={busy}
          type="submit"
        >
          {busy ? "Deleting…" : "Delete session"}
        </button>
      </DialogFooter>
    </form>
  );
}
