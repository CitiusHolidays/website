"use client";

import { api } from "@convex/_generated/api";
import { useMutation } from "convex/react";
import {
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
  type RefObject,
  useId,
  useRef,
  useState,
} from "react";
import { usePortalToast } from "@/components/portal/PortalToast";
import {
  ControlledDialog,
  ControlledDialogClose,
  ControlledDialogTitle,
} from "@/components/ui/application-dialog";
import {
  formatOfficeDateTime,
  formatOfficeTime,
  formatWorkDate,
  officeTimeToTimestamp,
  reasonProblem,
  timestampToClockTime,
} from "@/lib/officeCheckIn/presentation";
import { useTrackedQuery as useQuery } from "@/lib/portal/trackedConvexSubscriptions";
import { PORTAL_Z } from "@/lib/portal/zIndex";
import { formatConvexError } from "../portalWorkspaceListHelpers";
import { FieldError, OutcomeBadge, ReasonField, SignalList } from "./OfficeCheckInParts";
import type { CheckInRecord, TeamDayRow } from "./officeCheckInTypes";

export type TeamRecordDialogKind = "correct" | "manual" | "review";

export interface TeamRecordDialogTarget {
  kind: TeamRecordDialogKind;
  row: TeamDayRow;
  timeZone: string;
  workDate: string;
}

const FIELD_LABEL = "font-medium text-brand-dark text-sm";

function DialogFrame({
  busy,
  children,
  onClose,
  open,
}: {
  busy: boolean;
  children: ReactNode;
  onClose: () => void;
  open: boolean;
}) {
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      onClose();
    }
  };
  return (
    <ControlledDialog
      backdropClassName="absolute inset-0 bg-brand-dark/55"
      closeDisabled={busy}
      escapeDisabled={busy}
      onOpenChange={handleOpenChange}
      open={open}
      popupClassName="relative max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-brand-border bg-white p-6 shadow-xl"
      viewportClassName={`fixed inset-0 ${PORTAL_Z.entityModal} grid place-items-center p-4`}
    >
      {children}
    </ControlledDialog>
  );
}

function DialogActions({ busy, submitLabel }: { busy: boolean; submitLabel: string }) {
  const text = busy ? "Saving…" : submitLabel;
  return (
    <div className="mt-6 flex flex-wrap justify-end gap-2">
      <ControlledDialogClose className="portal-outline-btn" disabled={busy} type="button">
        Cancel
      </ControlledDialogClose>
      <button
        aria-busy={busy || undefined}
        className="portal-primary-btn"
        disabled={busy}
        type="submit"
      >
        {text}
      </button>
    </div>
  );
}

function ServerError({ message }: { message: string }) {
  if (!message) {
    return null;
  }
  return (
    <p
      className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700 text-sm"
      role="alert"
    >
      {message}
    </p>
  );
}

function RecordHistory({
  checkInId,
  timeZone,
}: {
  checkInId: CheckInRecord["_id"];
  timeZone: string;
}) {
  const events = useQuery(api.crm.officeCheckIns.history, { checkInId });
  if (events === undefined) {
    return <p className="text-brand-muted text-xs">Loading history…</p>;
  }
  if (events.length === 0) {
    return null;
  }
  return (
    <details className="rounded-xl border border-brand-border/70 px-3 py-2">
      <summary className="cursor-pointer font-medium text-brand-dark text-xs">
        Record history ({events.length})
      </summary>
      <ul className="mt-2 grid gap-2">
        {events.map((event) => (
          <li className="text-brand-muted text-xs" key={event.id}>
            <span className="tabular-nums">{formatOfficeDateTime(event.at, timeZone)}</span> ·{" "}
            {event.actorName}: {event.summary}
            {event.reason ? <span className="block text-brand-dark">“{event.reason}”</span> : null}
          </li>
        ))}
      </ul>
    </details>
  );
}

function RecordSummary({ record, timeZone }: { record: CheckInRecord; timeZone: string }) {
  return (
    <div className="mt-4 grid gap-3 rounded-xl bg-brand-light/60 p-4">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="tabular-nums">
          In {formatOfficeTime(record.clockInAt, timeZone)} · Out{" "}
          {formatOfficeTime(record.clockOutAt, timeZone)}
        </span>
        {record.source === "self" ? <OutcomeBadge outcome={record.clockIn.outcome} /> : null}
      </div>
      {record.source === "self" ? (
        <SignalList record={record.clockIn} />
      ) : (
        <p className="text-brand-muted text-xs">Manager entry. No device evidence.</p>
      )}
    </div>
  );
}

function useDialogSubmit(onBusyChange: (busy: boolean) => void) {
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState("");
  const run = async (action: () => Promise<void>, fallback: string) => {
    if (busy) {
      return;
    }
    setBusy(true);
    onBusyChange(true);
    setServerError("");
    try {
      await action();
    } catch (error) {
      setServerError(formatConvexError(error, fallback));
    }
    setBusy(false);
    onBusyChange(false);
  };
  return { busy, run, serverError };
}

interface FormProps {
  onBusyChange: (busy: boolean) => void;
  onDone: () => void;
  target: TeamRecordDialogTarget;
}

type ReviewDecision = "accepted" | "rejected";

function ReviewForm({ onBusyChange, onDone, target }: FormProps) {
  const toast = usePortalToast();
  const review = useMutation(api.crm.officeCheckIns.review);
  const { busy, run, serverError } = useDialogSubmit(onBusyChange);
  const [decision, setDecision] = useState<ReviewDecision | null>(null);
  const [reason, setReason] = useState("");
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [reasonError, setReasonError] = useState<string | null>(null);
  const reasonRef = useRef<HTMLTextAreaElement | null>(null);
  const decisionRef = useRef<HTMLInputElement | null>(null);
  const id = useId();
  const record = target.row.checkIn;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!record) {
      return;
    }
    const nextDecisionError = decision ? null : "Choose whether to accept or reject this check-in.";
    const nextReasonError = reasonProblem(reason);
    setDecisionError(nextDecisionError);
    setReasonError(nextReasonError);
    if (nextDecisionError) {
      decisionRef.current?.focus();
      return;
    }
    if (nextReasonError || !decision) {
      reasonRef.current?.focus();
      return;
    }
    await run(async () => {
      await review({ checkInId: record._id, decision, reason: reason.trim() });
      toast.success(`Review saved for ${target.row.name}.`);
      onDone();
    }, "Couldn't save the review. Try again.");
  };

  const choose = (event: ChangeEvent<HTMLInputElement>) => {
    setDecision(event.currentTarget.value === "rejected" ? "rejected" : "accepted");
    setDecisionError(null);
  };

  if (!record) {
    return null;
  }
  return (
    <form noValidate onSubmit={submit}>
      <ControlledDialogTitle className="font-heading font-semibold text-citius-blue text-lg">
        Review {target.row.name}'s check-in
      </ControlledDialogTitle>
      <p className="mt-1 text-brand-muted text-sm">
        {formatWorkDate(target.workDate)} · times in {target.timeZone}. A check result is evidence,
        not proof of where someone was.
      </p>
      <RecordSummary record={record} timeZone={target.timeZone} />
      <fieldset
        aria-describedby={decisionError ? `${id}-decision-error` : undefined}
        className="mt-5 grid gap-2"
      >
        <legend className={FIELD_LABEL}>Decision</legend>
        <label className="flex min-h-10 items-center gap-2 text-brand-dark text-sm">
          <input
            checked={decision === "accepted"}
            className="size-4 accent-citius-blue"
            name="decision"
            onChange={choose}
            ref={decisionRef}
            type="radio"
            value="accepted"
          />
          Accept: the check-in counts
        </label>
        <label className="flex min-h-10 items-center gap-2 text-brand-dark text-sm">
          <input
            checked={decision === "rejected"}
            className="size-4 accent-citius-blue"
            name="decision"
            onChange={choose}
            type="radio"
            value="rejected"
          />
          Reject: the check-in doesn't count
        </label>
        <FieldError id={`${id}-decision-error`} message={decisionError} />
      </fieldset>
      <div className="mt-4">
        <ReasonField error={reasonError} inputRef={reasonRef} onChange={setReason} value={reason} />
      </div>
      <div className="mt-4">
        <RecordHistory checkInId={record._id} timeZone={target.timeZone} />
      </div>
      <ServerError message={serverError} />
      <DialogActions busy={busy} submitLabel="Save review" />
    </form>
  );
}

function TimeField({
  error,
  hint,
  inputRef,
  label,
  onChange,
  value,
}: {
  error: string | null;
  hint?: string;
  inputRef?: RefObject<HTMLInputElement | null>;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  const id = useId();
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(" ");
  const handleChange = (event: ChangeEvent<HTMLInputElement>) =>
    onChange(event.currentTarget.value);
  return (
    <div className="grid gap-1.5">
      <label className={FIELD_LABEL} htmlFor={`${id}-time`}>
        {label}
      </label>
      <input
        aria-describedby={describedBy || undefined}
        aria-invalid={error ? true : undefined}
        className="portal-input tabular-nums aria-[invalid=true]:border-red-400"
        id={`${id}-time`}
        onChange={handleChange}
        ref={inputRef}
        type="time"
        value={value}
      />
      {hint ? (
        <p className="text-brand-muted text-xs" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

interface TimesDraft {
  clockIn: string;
  clockOut: string;
  reason: string;
}

interface TimesErrors {
  clockIn: string | null;
  clockOut: string | null;
  reason: string | null;
}

function validateTimes(draft: TimesDraft, target: TeamRecordDialogTarget) {
  const clockInAt = officeTimeToTimestamp(target.workDate, draft.clockIn, target.timeZone);
  const clockOutAt = draft.clockOut
    ? officeTimeToTimestamp(target.workDate, draft.clockOut, target.timeZone)
    : null;
  const errors: TimesErrors = {
    clockIn: clockInAt === null ? "Enter the clock-in time as HH:MM." : null,
    clockOut: null,
    reason: reasonProblem(draft.reason),
  };
  if (draft.clockOut && clockOutAt === null) {
    errors.clockOut = "Enter the clock-out time as HH:MM, or leave it empty.";
  } else if (clockInAt !== null && clockOutAt !== null && clockOutAt <= clockInAt) {
    errors.clockOut = "Clock-out must be after clock-in.";
  }
  return { clockInAt, clockOutAt, errors };
}

function TimesForm({
  description,
  onSave,
  submitLabel,
  target,
  title,
  initial,
  onBusyChange,
}: {
  description: string;
  initial: TimesDraft;
  onBusyChange: (busy: boolean) => void;
  onSave: (input: {
    clockInAt: number;
    clockOutAt: number | null;
    reason: string;
  }) => Promise<void>;
  submitLabel: string;
  target: TeamRecordDialogTarget;
  title: string;
}) {
  const { busy, run, serverError } = useDialogSubmit(onBusyChange);
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<TimesErrors>({
    clockIn: null,
    clockOut: null,
    reason: null,
  });
  const clockInRef = useRef<HTMLInputElement | null>(null);
  const reasonRef = useRef<HTMLTextAreaElement | null>(null);
  const setField = (field: keyof TimesDraft) => (value: string) =>
    setDraft((current) => ({ ...current, [field]: value }));

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = validateTimes(draft, target);
    setErrors(result.errors);
    if (result.errors.clockIn || result.errors.clockOut || result.clockInAt === null) {
      clockInRef.current?.focus();
      return;
    }
    if (result.errors.reason) {
      reasonRef.current?.focus();
      return;
    }
    const { clockInAt, clockOutAt } = result;
    await run(
      () => onSave({ clockInAt, clockOutAt, reason: draft.reason.trim() }),
      "Couldn't save these times. Try again."
    );
  };

  return (
    <form noValidate onSubmit={submit}>
      <ControlledDialogTitle className="font-heading font-semibold text-citius-blue text-lg">
        {title}
      </ControlledDialogTitle>
      <p className="mt-1 text-brand-muted text-sm">{description}</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <TimeField
          error={errors.clockIn}
          inputRef={clockInRef}
          label="Clock-in time"
          onChange={setField("clockIn")}
          value={draft.clockIn}
        />
        <TimeField
          error={errors.clockOut}
          hint="Leave empty if they're still in the office."
          label="Clock-out time"
          onChange={setField("clockOut")}
          value={draft.clockOut}
        />
      </div>
      <div className="mt-4">
        <ReasonField
          error={errors.reason}
          inputRef={reasonRef}
          onChange={setField("reason")}
          value={draft.reason}
        />
      </div>
      <ServerError message={serverError} />
      <DialogActions busy={busy} submitLabel={submitLabel} />
    </form>
  );
}

function CorrectForm({ onBusyChange, onDone, target }: FormProps) {
  const toast = usePortalToast();
  const correctTimes = useMutation(api.crm.officeCheckIns.correctTimes);
  const record = target.row.checkIn;
  if (!record) {
    return null;
  }
  const save = async (input: { clockInAt: number; clockOutAt: number | null; reason: string }) => {
    await correctTimes({ checkInId: record._id, ...input });
    toast.success(`Times corrected for ${target.row.name}.`);
    onDone();
  };
  return (
    <>
      <TimesForm
        description={`${formatWorkDate(target.workDate)} · times in ${target.timeZone}.`}
        initial={{
          clockIn: timestampToClockTime(record.clockInAt, target.timeZone),
          clockOut: timestampToClockTime(record.clockOutAt, target.timeZone),
          reason: "",
        }}
        onBusyChange={onBusyChange}
        onSave={save}
        submitLabel="Save times"
        target={target}
        title={`Correct ${target.row.name}'s times`}
      />
      <div className="mt-4">
        <RecordHistory checkInId={record._id} timeZone={target.timeZone} />
      </div>
    </>
  );
}

function ManualEntryForm({ onBusyChange, onDone, target }: FormProps) {
  const toast = usePortalToast();
  const recordManualEntry = useMutation(api.crm.officeCheckIns.recordManualEntry);
  const save = async (input: { clockInAt: number; clockOutAt: number | null; reason: string }) => {
    await recordManualEntry({ staffId: target.row.staffId, workDate: target.workDate, ...input });
    toast.success(`Entry recorded for ${target.row.name}.`);
    onDone();
  };
  return (
    <TimesForm
      description={`${formatWorkDate(target.workDate)} · times in ${target.timeZone}. Use this when ${target.row.name} was in the office but couldn't check in. It's saved as a manager entry with no device evidence.`}
      initial={{ clockIn: "", clockOut: "", reason: "" }}
      onBusyChange={onBusyChange}
      onSave={save}
      submitLabel="Record entry"
      target={target}
      title={`Add an entry for ${target.row.name}`}
    />
  );
}

const FORMS = {
  correct: CorrectForm,
  manual: ManualEntryForm,
  review: ReviewForm,
} satisfies Record<TeamRecordDialogKind, (props: FormProps) => ReactNode>;

/** One dialog host for Review, Correct times and Add entry. Every save needs a reason. */
export function TeamRecordDialog({
  onClose,
  target,
}: {
  onClose: () => void;
  target: TeamRecordDialogTarget | null;
}) {
  const [busy, setBusy] = useState(false);
  const Form = target ? FORMS[target.kind] : null;
  return (
    <DialogFrame busy={busy} onClose={onClose} open={Boolean(target)}>
      {target && Form ? (
        <Form
          key={`${target.kind}:${target.row.staffId}:${target.workDate}`}
          onBusyChange={setBusy}
          onDone={onClose}
          target={target}
        />
      ) : null}
    </DialogFrame>
  );
}
